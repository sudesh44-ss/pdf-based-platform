import {
  Document,
  Folder,
  Notebook,
  Note,
  Bookmark,
  Annotation,
  ReadingProgress,
  BackupJob,
  ContributionSubmission,
  ContentReport,
} from '../types/database';
import {
  INITIAL_DOCUMENTS,
  INITIAL_FOLDERS,
  INITIAL_NOTEBOOKS,
  INITIAL_NOTES,
  INITIAL_BOOKMARKS,
  INITIAL_READING_PROGRESS,
  INITIAL_BACKUP_JOBS,
  INITIAL_SUBMISSIONS,
} from './mockData';

// Storage keys for localStorage persistence
const STORAGE_KEYS = {
  DOCUMENTS: 'smart_pdf_documents_v1',
  FOLDERS: 'smart_pdf_folders_v1',
  NOTEBOOKS: 'smart_pdf_notebooks_v1',
  NOTES: 'smart_pdf_notes_v1',
  BOOKMARKS: 'smart_pdf_bookmarks_v1',
  ANNOTATIONS: 'smart_pdf_annotations_v1',
  PROGRESS: 'smart_pdf_progress_v1',
  BACKUP_JOBS: 'smart_pdf_backup_jobs_v1',
  SUBMISSIONS: 'smart_pdf_submissions_v1',
  REPORTS: 'smart_pdf_reports_v1',
};

class StorageEngine {
  private isClient = typeof window !== 'undefined';

  private getItem<T>(key: string, fallback: T): T {
    if (!this.isClient) return fallback;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return fallback;
      return JSON.parse(stored);
    } catch {
      return fallback;
    }
  }

  private setItem<T>(key: string, value: T): void {
    if (!this.isClient) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to persist to localStorage', e);
    }
  }

  // --- DOCUMENTS ---
  public getDocuments(filter?: {
    isPublic?: boolean;
    userId?: string;
    includeTrash?: boolean;
    search?: string;
    category?: string;
    tag?: string;
    sort?: 'latest' | 'popular' | 'pages' | 'title';
  }): Document[] {
    let docs = this.getItem<Document[]>(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);

    if (filter?.isPublic !== undefined) {
      docs = docs.filter((d) => d.is_public === filter.isPublic && d.status === 'published');
    }

    if (filter?.userId) {
      docs = docs.filter((d) => d.user_id === filter.userId);
    }

    if (!filter?.includeTrash) {
      docs = docs.filter((d) => !d.is_trash);
    } else {
      docs = docs.filter((d) => d.is_trash);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q)) ||
          d.tags.some((t) => t.toLowerCase().includes(q)) ||
          (d.contributor_name && d.contributor_name.toLowerCase().includes(q))
      );
    }

    if (filter?.category && filter.category !== 'all') {
      docs = docs.filter((d) => d.categories.includes(filter.category!));
    }

    if (filter?.tag) {
      docs = docs.filter((d) => d.tags.includes(filter.tag!));
    }

    if (filter?.sort) {
      docs = [...docs].sort((a, b) => {
        if (filter.sort === 'popular') return b.likes_count - a.likes_count;
        if (filter.sort === 'pages') return b.page_count - a.page_count;
        if (filter.sort === 'title') return a.title.localeCompare(b.title);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return docs;
  }

  public getDocumentById(id: string): Document | undefined {
    const docs = this.getItem<Document[]>(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    return docs.find((d) => d.id === id);
  }

  public createDocument(doc: Partial<Document> & { title: string; file_name: string; file_size: number }): Document {
    const docs = this.getItem<Document[]>(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    const newDoc: Document = {
      id: doc.id || `doc-${Date.now()}`,
      user_id: doc.user_id || 'current-user-id',
      title: doc.title,
      description: doc.description || null,
      file_name: doc.file_name,
      file_size: doc.file_size,
      file_hash: doc.file_hash || null,
      mime_type: doc.mime_type || 'application/pdf',
      page_count: doc.page_count || 1,
      cover_image_url: doc.cover_image_url || null,
      storage_type: doc.storage_type || 'telegram',
      storage_file_id: doc.storage_file_id || null,
      storage_file_path: doc.storage_file_path || '/samples/sample-study-guide.pdf',
      is_public: doc.is_public ?? false,
      status: doc.status || 'published',
      categories: doc.categories || [],
      tags: doc.tags || [],
      likes_count: 0,
      views_count: 0,
      is_trash: false,
      trashed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contributor_name: doc.contributor_name || 'You',
    };
    docs.unshift(newDoc);
    this.setItem(STORAGE_KEYS.DOCUMENTS, docs);
    return newDoc;
  }

  public updateDocument(id: string, updates: Partial<Document>): Document | null {
    const docs = this.getItem<Document[]>(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    const index = docs.findIndex((d) => d.id === id);
    if (index === -1) return null;
    docs[index] = { ...docs[index], ...updates, updated_at: new Date().toISOString() };
    this.setItem(STORAGE_KEYS.DOCUMENTS, docs);
    return docs[index];
  }

  public toggleTrash(id: string, isTrash: boolean): boolean {
    const doc = this.updateDocument(id, {
      is_trash: isTrash,
      trashed_at: isTrash ? new Date().toISOString() : null,
    });
    return !!doc;
  }

  public deleteDocumentPermanently(id: string): boolean {
    let docs = this.getItem<Document[]>(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    const initialLen = docs.length;
    docs = docs.filter((d) => d.id !== id);
    this.setItem(STORAGE_KEYS.DOCUMENTS, docs);
    return docs.length < initialLen;
  }

  public toggleLike(documentId: string): { isLiked: boolean; likesCount: number } {
    const docs = this.getItem<Document[]>(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    const doc = docs.find((d) => d.id === documentId);
    if (!doc) return { isLiked: false, likesCount: 0 };
    doc.is_liked = !doc.is_liked;
    doc.likes_count = Math.max(0, doc.likes_count + (doc.is_liked ? 1 : -1));
    this.setItem(STORAGE_KEYS.DOCUMENTS, docs);
    return { isLiked: !!doc.is_liked, likesCount: doc.likes_count };
  }

  public toggleFavorite(documentId: string): boolean {
    const docs = this.getItem<Document[]>(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
    const doc = docs.find((d) => d.id === documentId);
    if (!doc) return false;
    doc.is_favorite = !doc.is_favorite;
    this.setItem(STORAGE_KEYS.DOCUMENTS, docs);
    return !!doc.is_favorite;
  }

  // --- FOLDERS ---
  public getFolders(): Folder[] {
    return this.getItem<Folder[]>(STORAGE_KEYS.FOLDERS, INITIAL_FOLDERS);
  }

  public createFolder(name: string, color = '#3b82f6', icon = 'folder'): Folder {
    const folders = this.getFolders();
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      user_id: 'current-user-id',
      name,
      color,
      icon,
      document_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    folders.push(newFolder);
    this.setItem(STORAGE_KEYS.FOLDERS, folders);
    return newFolder;
  }

  // --- NOTEBOOKS ---
  public getNotebooks(): Notebook[] {
    return this.getItem<Notebook[]>(STORAGE_KEYS.NOTEBOOKS, INITIAL_NOTEBOOKS);
  }

  public createNotebook(title: string, description?: string, color = '#8b5cf6'): Notebook {
    const notebooks = this.getNotebooks();
    const newNotebook: Notebook = {
      id: `nb-${Date.now()}`,
      user_id: 'current-user-id',
      title,
      description: description || null,
      color,
      is_favorite: false,
      note_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    notebooks.unshift(newNotebook);
    this.setItem(STORAGE_KEYS.NOTEBOOKS, notebooks);
    return newNotebook;
  }

  // --- NOTES ---
  public getNotes(filter?: {
    documentId?: string;
    notebookId?: string;
    search?: string;
    tag?: string;
  }): Note[] {
    let notes = this.getItem<Note[]>(STORAGE_KEYS.NOTES, INITIAL_NOTES);
    if (filter?.documentId) {
      notes = notes.filter((n) => n.document_id === filter.documentId);
    }
    if (filter?.notebookId) {
      notes = notes.filter((n) => n.notebook_id === filter.notebookId);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      notes = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content_html.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filter?.tag) {
      notes = notes.filter((n) => n.tags.includes(filter.tag!));
    }
    return notes;
  }

  public getNoteById(id: string): Note | undefined {
    const notes = this.getItem<Note[]>(STORAGE_KEYS.NOTES, INITIAL_NOTES);
    return notes.find((n) => n.id === id);
  }

  public saveNote(note: Partial<Note> & { title: string }): Note {
    const notes = this.getItem<Note[]>(STORAGE_KEYS.NOTES, INITIAL_NOTES);
    const existingIndex = notes.findIndex((n) => n.id === note.id);

    if (existingIndex >= 0) {
      const updated: Note = {
        ...notes[existingIndex],
        ...note,
        updated_at: new Date().toISOString(),
      };
      notes[existingIndex] = updated;
      this.setItem(STORAGE_KEYS.NOTES, notes);
      return updated;
    } else {
      const newNote: Note = {
        id: note.id || `note-${Date.now()}`,
        user_id: 'current-user-id',
        notebook_id: note.notebook_id || null,
        document_id: note.document_id || null,
        page_number: note.page_number || null,
        title: note.title,
        content_json: note.content_json || { type: 'doc', content: [] },
        content_html: note.content_html || '',
        tags: note.tags || [],
        is_favorite: !!note.is_favorite,
        selected_text: note.selected_text || null,
        highlight_coords: note.highlight_coords || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        document_title: note.document_title,
        notebook_title: note.notebook_title,
      };
      notes.unshift(newNote);
      this.setItem(STORAGE_KEYS.NOTES, notes);
      return newNote;
    }
  }

  public deleteNote(id: string): boolean {
    let notes = this.getItem<Note[]>(STORAGE_KEYS.NOTES, INITIAL_NOTES);
    const initialLen = notes.length;
    notes = notes.filter((n) => n.id !== id);
    this.setItem(STORAGE_KEYS.NOTES, notes);
    return notes.length < initialLen;
  }

  // --- BOOKMARKS ---
  public getBookmarks(documentId?: string): Bookmark[] {
    let bookmarks = this.getItem<Bookmark[]>(STORAGE_KEYS.BOOKMARKS, INITIAL_BOOKMARKS);
    if (documentId) {
      bookmarks = bookmarks.filter((b) => b.document_id === documentId);
    }
    return bookmarks;
  }

  public addBookmark(bookmark: { document_id: string; page_number: number; title?: string; color?: string; document_title?: string }): Bookmark {
    const bookmarks = this.getBookmarks();
    const existing = bookmarks.find(
      (b) => b.document_id === bookmark.document_id && b.page_number === bookmark.page_number
    );
    if (existing) return existing;

    const newBm: Bookmark = {
      id: `bm-${Date.now()}`,
      user_id: 'current-user-id',
      document_id: bookmark.document_id,
      page_number: bookmark.page_number,
      title: bookmark.title || `Page ${bookmark.page_number}`,
      color: bookmark.color || '#3b82f6',
      created_at: new Date().toISOString(),
      document_title: bookmark.document_title,
    };
    bookmarks.push(newBm);
    this.setItem(STORAGE_KEYS.BOOKMARKS, bookmarks);
    return newBm;
  }

  public removeBookmark(documentId: string, pageNumber: number): boolean {
    let bookmarks = this.getBookmarks();
    const initialLen = bookmarks.length;
    bookmarks = bookmarks.filter(
      (b) => !(b.document_id === documentId && b.page_number === pageNumber)
    );
    this.setItem(STORAGE_KEYS.BOOKMARKS, bookmarks);
    return bookmarks.length < initialLen;
  }

  // --- ANNOTATIONS ---
  public getAnnotations(documentId: string, pageNumber?: number): Annotation[] {
    let annotations = this.getItem<Annotation[]>(STORAGE_KEYS.ANNOTATIONS, []);
    annotations = annotations.filter((a) => a.document_id === documentId);
    if (pageNumber !== undefined) {
      annotations = annotations.filter((a) => a.page_number === pageNumber);
    }
    return annotations;
  }

  public saveAnnotation(annotation: Partial<Annotation> & { document_id: string; page_number: number; type: any }): Annotation {
    const list = this.getItem<Annotation[]>(STORAGE_KEYS.ANNOTATIONS, []);
    const newAnn: Annotation = {
      id: annotation.id || `ann-${Date.now()}`,
      user_id: 'current-user-id',
      document_id: annotation.document_id,
      page_number: annotation.page_number,
      type: annotation.type,
      color: annotation.color || '#fef08a',
      rects: annotation.rects || [],
      content: annotation.content || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.push(newAnn);
    this.setItem(STORAGE_KEYS.ANNOTATIONS, list);
    return newAnn;
  }

  // --- READING PROGRESS ---
  public getReadingProgress(documentId: string): ReadingProgress | undefined {
    const list = this.getItem<ReadingProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_READING_PROGRESS);
    return list.find((p) => p.document_id === documentId);
  }

  public getAllReadingProgress(): ReadingProgress[] {
    return this.getItem<ReadingProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_READING_PROGRESS);
  }

  public saveReadingProgress(progress: Partial<ReadingProgress> & { document_id: string; current_page: number; total_pages: number }): ReadingProgress {
    const list = this.getItem<ReadingProgress[]>(STORAGE_KEYS.PROGRESS, INITIAL_READING_PROGRESS);
    const existingIndex = list.findIndex((p) => p.document_id === progress.document_id);

    const percentage = Math.min(100, Math.round((progress.current_page / Math.max(1, progress.total_pages)) * 1000) / 10);

    if (existingIndex >= 0) {
      const updated: ReadingProgress = {
        ...list[existingIndex],
        ...progress,
        percentage,
        active_seconds: (list[existingIndex].active_seconds || 0) + (progress.active_seconds || 0),
        last_read_at: new Date().toISOString(),
      };
      list[existingIndex] = updated;
      this.setItem(STORAGE_KEYS.PROGRESS, list);
      return updated;
    } else {
      const newProgress: ReadingProgress = {
        id: `rp-${Date.now()}`,
        user_id: 'current-user-id',
        document_id: progress.document_id,
        current_page: progress.current_page,
        total_pages: progress.total_pages,
        percentage,
        zoom_level: progress.zoom_level || 1.0,
        view_mode: progress.view_mode || 'single',
        crop_settings: progress.crop_settings || null,
        active_seconds: progress.active_seconds || 0,
        last_read_at: new Date().toISOString(),
      };
      list.push(newProgress);
      this.setItem(STORAGE_KEYS.PROGRESS, list);
      return newProgress;
    }
  }

  // --- BACKUP JOBS ---
  public getBackupJobs(): BackupJob[] {
    return this.getItem<BackupJob[]>(STORAGE_KEYS.BACKUP_JOBS, INITIAL_BACKUP_JOBS);
  }

  public createBackupJob(totalItems: number, destination: 'telegram' | 'r2' | 'local' = 'telegram'): BackupJob {
    const jobs = this.getBackupJobs();
    const newJob: BackupJob = {
      id: `job-${Date.now()}`,
      user_id: 'current-user-id',
      destination,
      status: 'completed',
      total_items: totalItems,
      successful_items: totalItems,
      failed_items: 0,
      error_log: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    jobs.unshift(newJob);
    this.setItem(STORAGE_KEYS.BACKUP_JOBS, jobs);
    return newJob;
  }

  // --- CONTRIBUTIONS & MODERATION ---
  public getSubmissions(): ContributionSubmission[] {
    return this.getItem<ContributionSubmission[]>(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
  }

  public createSubmission(sub: {
    title: string;
    description?: string;
    file_name: string;
    file_size: number;
    categories: string[];
    tags: string[];
    rights_declared: boolean;
  }): ContributionSubmission {
    const submissions = this.getSubmissions();
    const newSub: ContributionSubmission = {
      id: `sub-${Date.now()}`,
      user_id: 'current-user-id',
      document_id: null,
      title: sub.title,
      description: sub.description || null,
      file_name: sub.file_name,
      file_size: sub.file_size,
      categories: sub.categories,
      tags: sub.tags,
      rights_declared: sub.rights_declared,
      status: 'pending_review',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    submissions.unshift(newSub);
    this.setItem(STORAGE_KEYS.SUBMISSIONS, submissions);
    return newSub;
  }

  public reviewSubmission(id: string, action: 'approve' | 'reject', reason?: string): boolean {
    const submissions = this.getSubmissions();
    const sub = submissions.find((s) => s.id === id);
    if (!sub) return false;

    sub.status = action === 'approve' ? 'published' : 'rejected';
    sub.rejection_reason = action === 'reject' ? reason || 'Not meeting public quality criteria' : null;
    sub.reviewed_by = 'admin-user-id';
    sub.reviewed_at = new Date().toISOString();
    sub.updated_at = new Date().toISOString();

    if (action === 'approve') {
      // Create published document
      this.createDocument({
        title: sub.title,
        description: sub.description,
        file_name: sub.file_name,
        file_size: sub.file_size,
        categories: sub.categories,
        tags: sub.tags,
        is_public: true,
        status: 'published',
        contributor_name: 'Community Contributor',
      });
    }

    this.setItem(STORAGE_KEYS.SUBMISSIONS, submissions);
    return true;
  }

  // --- CONTENT REPORTS ---
  public getContentReports(): ContentReport[] {
    return this.getItem<ContentReport[]>(STORAGE_KEYS.REPORTS, [
      {
        id: 'rep-01',
        reporter_id: 'user-02',
        document_id: 'doc-dist-sys-01',
        document_title: 'Modern Distributed Systems & Cloud Patterns',
        reason: 'corrupted',
        details: 'Page 12 formula font rendering artifact reported on mobile browser.',
        status: 'resolved',
        resolution_notes: 'Verified font embedding and re-rendered thumbnail.',
        created_at: '2026-10-18T10:00:00Z',
      },
    ]);
  }

  public createContentReport(report: { document_id: string; reason: any; details?: string; document_title?: string }): ContentReport {
    const reports = this.getContentReports();
    const newReport: ContentReport = {
      id: `rep-${Date.now()}`,
      reporter_id: 'current-user-id',
      document_id: report.document_id,
      document_title: report.document_title,
      reason: report.reason,
      details: report.details || null,
      status: 'pending',
      resolution_notes: null,
      created_at: new Date().toISOString(),
    };
    reports.unshift(newReport);
    this.setItem(STORAGE_KEYS.REPORTS, reports);
    return newReport;
  }
}

export const storageEngine = new StorageEngine();
