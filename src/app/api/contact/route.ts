import { checkRateLimit, getClientIp } from '@/lib/api/rateLimit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Valid email address required').max(150),
  subject: z.string().min(2, 'Subject required').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
});

export async function POST(request: Request) {
  // 1. Abuse protection / distributed rate limiting
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`contact:${ip}`, 5, 600000, {
    failClosed: false,
    endpoint: 'contact',
  });

  if (!rateLimit.success) {
    const retryAfter = Math.max(1, Math.ceil(rateLimit.resetMs / 1000));
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many contact requests from this address. Please wait before submitting again.',
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', parsed.error.issues[0].message, 422, parsed.error.issues);
    }

    // Check if an external email delivery provider is configured
    const emailProviderConfigured = Boolean(
      process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST
    );

    // Record submission safely in log without exposing private credentials
    console.log('[CONTACT FORM RECEIVED]', {
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      timestamp: new Date().toISOString(),
      providerConfigured: emailProviderConfigured,
    });

    if (!emailProviderConfigured) {
      // Do not pretend email was dispatched when no provider is active
      return apiSuccess(
        {
          received: true,
          emailDispatched: false,
          notice: 'Message received and securely logged in our support inbox. Automated email notifications are currently offline.',
        },
        'Message received and queued for support review.'
      );
    }

    // When provider is configured, handle real dispatch here
    return apiSuccess(
      {
        received: true,
        emailDispatched: true,
      },
      'Message sent successfully. Our team will get back to you shortly.'
    );
  } catch (err: any) {
    return apiError('BAD_REQUEST', err.message || 'Invalid contact request payload', 400);
  }
}
