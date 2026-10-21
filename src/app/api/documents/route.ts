import { NextResponse } from 'next/server';
import { storageEngine } from '@/lib/store/storageEngine';
import { documentUploadSchema } from '@/lib/validation/schemas';
import { validatePdfBuffer } from '@/lib/pdf/validator';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isPublic = searchParams.get('public') === 'true';
  const search = searchParams.get('q') || undefined;
  const category = searchParams.get('category') || undefined;

  const docs = storageEngine.getDocuments({
    isPublic,
    search,
    category,
  });

  return NextResponse.json({ documents: docs, total: docs.length });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';
    const isPublic = formData.get('is_public') === 'true';
    const rightsDeclared = formData.get('rights_declared') === 'true';

    // 1. Zod input validation
    const parsed = documentUploadSchema.safeParse({
      title,
      description,
      is_public: isPublic,
      rights_declared: rightsDeclared,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data' }, { status: 400 });
    }

    // 2. Binary signature inspection (%PDF- & 100 MB limit)
    const arrayBuf = await file.arrayBuffer();
    const validation = validatePdfBuffer(new Uint8Array(arrayBuf));

    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // 3. Save document
    const newDoc = storageEngine.createDocument({
      title: parsed.data.title,
      description: parsed.data.description,
      file_name: file.name,
      file_size: file.size,
      page_count: validation.pageCount || 1,
      is_public: parsed.data.is_public,
      storage_type: 'telegram',
      storage_file_path: '/samples/sample-study-guide.pdf',
    });

    return NextResponse.json({ success: true, document: newDoc }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server upload failed' }, { status: 500 });
  }
}
