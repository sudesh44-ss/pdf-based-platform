import { NextResponse } from 'next/server';
import { storageEngine } from '@/lib/store/storageEngine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = storageEngine.getDocumentById(id);

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json({ document: doc });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = storageEngine.toggleTrash(id, true);

  if (!success) {
    return NextResponse.json({ error: 'Could not move document to trash' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Document moved to trash' });
}
