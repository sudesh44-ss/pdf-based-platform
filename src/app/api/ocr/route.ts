import { NextResponse } from 'next/server';
import { ocrRequestSchema } from '@/lib/validation/schemas';
import { ocrEngine } from '@/lib/ocr/engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ocrRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { document_id, page_number } = parsed.data;

    // Run OCR simulation or page worker
    const result = ocrEngine.simulatePageOcr(page_number);

    return NextResponse.json({
      success: true,
      document_id,
      page_number,
      extracted_text: result.text,
      confidence: result.confidence,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'OCR processing failed' }, { status: 500 });
  }
}
