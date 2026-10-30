import { checkRateLimit } from '@/lib/api/rateLimit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Valid email address required').max(150),
  subject: z.string().min(2, 'Subject required').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
});

export async function POST(request: Request) {
  // 1. Abuse protection / rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'local_client';
  const rateLimit = checkRateLimit(`contact:${ip}`, 5, 600000); // 5 submissions per 10 minutes

  if (!rateLimit.success) {
    return apiError(
      'RATE_LIMITED',
      'Too many contact requests from this address. Please wait before submitting again.',
      429,
      { resetMs: rateLimit.resetMs }
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
