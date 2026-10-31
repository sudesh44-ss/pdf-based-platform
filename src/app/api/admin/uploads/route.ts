import { getVerifiedAdminSession } from '@/lib/auth/adminAuth';
import {
  getTelegramUploads,
  createAdminDirectUpload,
  isPdfBuffer,
} from '@/lib/services/telegramService';
import { ADMIN_DIRECT_UPLOAD_LIMITS } from '@/lib/telegram/limits';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: Request) {
  const session = await getVerifiedAdminSession();
  if (!session.valid) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') || 'all') as any;
  const search = searchParams.get('q') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const result = await getTelegramUploads({
      status,
      search,
      page,
      limit,
    });
    return apiSuccess(result);
  } catch (err: any) {
    console.error('Error fetching admin uploads:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Failed to retrieve uploads', 500);
  }
}

export async function POST(request: Request) {
  const session = await getVerifiedAdminSession();
  if (!session.valid || !session.username) {
    return apiError('UNAUTHORIZED', 'Administrator session required', 401);
  }

  // 1. Validate request payload size header before reading body if present
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > ADMIN_DIRECT_UPLOAD_LIMITS.MAX_REQUEST_BYTES) {
    return apiError(
      'PAYLOAD_TOO_LARGE',
      'Request payload exceeds the 4 MB limit for Vercel direct uploads. For files up to 20 MB, please post directly into your authorized Telegram group for automatic ingestion.',
      413
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return apiError('INVALID_INPUT', 'A PDF file is required', 400);
    }

    // 2. Validate file size against 4 MB Vercel Serverless Function limit
    if (file.size > ADMIN_DIRECT_UPLOAD_LIMITS.MAX_FILE_BYTES) {
      return apiError(
        'PAYLOAD_TOO_LARGE',
        `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 4 MB limit for direct browser uploads. For files up to 20 MB, please post directly into your authorized Telegram group for automatic ingestion.`,
        413
      );
    }

    // 3. Validate file extension
    const fileName = file.name || '';
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      return apiError(
        'INVALID_EXTENSION',
        'Invalid file extension. Only .pdf files are accepted.',
        400
      );
    }

    // 4. Validate MIME type
    const mimeType = file.type?.toLowerCase();
    if (mimeType && mimeType !== 'application/pdf' && mimeType !== 'application/x-pdf') {
      return apiError(
        'INVALID_MIME_TYPE',
        `Unsupported MIME type (${mimeType}). File must be application/pdf.`,
        400
      );
    }

    // 5. Read buffer & check %PDF- magic signature
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    if (!isPdfBuffer(fileBuffer)) {
      return apiError(
        'INVALID_PDF_SIGNATURE',
        'Invalid file format: file does not contain a valid %PDF- magic signature.',
        400
      );
    }

    const rawTitle = (formData.get('title') as string) || '';
    const title =
      rawTitle.trim() ||
      fileName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ') ||
      'Untitled PDF Document';

    const description = (formData.get('description') as string) || '';
    const categoryId = (formData.get('category_id') as string) || undefined;
    const categoryName = (formData.get('category_name') as string) || undefined;
    const author = (formData.get('author') as string) || undefined;
    const language = (formData.get('language') as string) || 'en';
    const rawYear = formData.get('publication_year') as string | null;
    const publicationYear = rawYear ? parseInt(rawYear, 10) : undefined;

    // Parse tags (comma separated or JSON array)
    let tags: string[] = [];
    const rawTags = formData.get('tags');
    if (rawTags) {
      if (typeof rawTags === 'string') {
        try {
          const parsed = JSON.parse(rawTags);
          tags = Array.isArray(parsed) ? parsed : [rawTags];
        } catch {
          tags = rawTags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      }
    }

    const result = await createAdminDirectUpload(
      {
        fileBuffer,
        fileName,
        title,
        description,
        categoryId,
        categoryName,
        tags,
        author,
        language,
        publicationYear,
      },
      session.username
    );

    if (!result.success || !result.upload) {
      return apiError('UPLOAD_FAILED', result.error || 'Failed to process admin PDF upload', 422);
    }

    return apiSuccess(
      {
        upload: result.upload,
        is_duplicate: result.isDuplicate,
      },
      'PDF uploaded directly to Telegram and queued for review'
    );
  } catch (err: any) {
    console.error('Error in admin direct upload:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Direct upload failed', 500);
  }
}
