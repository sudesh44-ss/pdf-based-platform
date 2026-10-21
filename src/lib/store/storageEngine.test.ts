import { describe, it, expect, beforeEach } from 'vitest';
import { storageEngine } from './storageEngine';

describe('Storage Engine Persistence & Operations', () => {
  it('retrieves public catalog documents', () => {
    const docs = storageEngine.getDocuments({ isPublic: true });
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => d.is_public)).toBe(true);
  });

  it('filters documents by search query', () => {
    const searchResults = storageEngine.getDocuments({ search: 'Distributed' });
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].title).toContain('Distributed');
  });

  it('supports like toggling with duplicate prevention', () => {
    const docId = 'doc-dist-sys-01';
    const initialDoc = storageEngine.getDocumentById(docId)!;
    const initialLikes = initialDoc.likes_count;

    const liked = storageEngine.toggleLike(docId);
    expect(liked.isLiked).toBe(true);
    expect(liked.likesCount).toBe(initialLikes + 1);

    const unliked = storageEngine.toggleLike(docId);
    expect(unliked.isLiked).toBe(false);
    expect(unliked.likesCount).toBe(initialLikes);
  });

  it('supports recoverable trash workflow', () => {
    const doc = storageEngine.createDocument({
      title: 'Temporary Test Document',
      file_name: 'test.pdf',
      file_size: 1024,
    });

    // 1. Move to trash
    storageEngine.toggleTrash(doc.id, true);
    const inTrash = storageEngine.getDocuments({ includeTrash: true }).find((d) => d.id === doc.id);
    expect(inTrash?.is_trash).toBe(true);

    const activeList = storageEngine.getDocuments({ includeTrash: false }).find((d) => d.id === doc.id);
    expect(activeList).toBeUndefined();

    // 2. Restore from trash
    storageEngine.toggleTrash(doc.id, false);
    const restored = storageEngine.getDocuments({ includeTrash: false }).find((d) => d.id === doc.id);
    expect(restored).toBeDefined();
    expect(restored?.is_trash).toBe(false);

    // 3. Permanent deletion
    storageEngine.deleteDocumentPermanently(doc.id);
    const deleted = storageEngine.getDocumentById(doc.id);
    expect(deleted).toBeUndefined();
  });

  it('persists notes and links them to documents and pages', () => {
    const note = storageEngine.saveNote({
      document_id: 'doc-dist-sys-01',
      page_number: 5,
      title: 'Consensus Quorum Analysis',
      content_html: '<p>Requires majority (N/2 + 1) alive nodes.</p>',
    });

    expect(note.id).toBeDefined();
    const fetched = storageEngine.getNoteById(note.id);
    expect(fetched?.title).toBe('Consensus Quorum Analysis');
    expect(fetched?.page_number).toBe(5);

    storageEngine.deleteNote(note.id);
    expect(storageEngine.getNoteById(note.id)).toBeUndefined();
  });

  it('tracks reading progress and calculates percentage', () => {
    const progress = storageEngine.saveReadingProgress({
      document_id: 'doc-dist-sys-01',
      current_page: 7,
      total_pages: 14,
      zoom_level: 1.25,
      active_seconds: 60,
    });

    expect(progress.current_page).toBe(7);
    expect(progress.percentage).toBe(50);

    const saved = storageEngine.getReadingProgress('doc-dist-sys-01');
    expect(saved?.current_page).toBe(7);
    expect(saved?.percentage).toBe(50);
  });
});
