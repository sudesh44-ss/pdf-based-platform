import { NextResponse } from 'next/server';
import { storageEngine } from '@/lib/store/storageEngine';
import { submissionReviewSchema } from '@/lib/validation/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = submissionReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { submission_id, action, rejection_reason } = parsed.data;
    const success = storageEngine.reviewSubmission(submission_id, action, rejection_reason);

    if (!success) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Submission ${submission_id} marked as ${action}d.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Moderation action failed' }, { status: 500 });
  }
}
