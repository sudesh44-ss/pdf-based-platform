import {
  Document,
  Folder,
  Notebook,
  Note,
  Bookmark,
  Annotation,
  ReadingProgress,
  ContributionSubmission,
  ContentReport,
  Profile,
} from '../types/database';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.success === false) {
    const errorMsg = json.error?.message || json.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).code = json.error?.code;
    throw err;
  }

  return (json.data !== undefined ? json.data : json) as T;
}

export const api = {
  // Auth
  auth: {
    async getMe(): Promise<{ user: { id: string; email: string } | null; profile: Profile | null; isAdmin: boolean; isAuthenticated?: boolean }> {
      return request('/api/auth/me');
    },
    async logout(): Promise<void> {
      await request('/api/auth/logout', { method: 'POST' });
    },
    async getProfile(): Promise<Profile> {
      return request('/api/profile');
    },
    async updateProfile(updates: { full_name?: string; avatar_url?: string | null }): Promise<Profile> {
      return request('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
  },

  // User Profile
  profile: {
    async get(): Promise<Profile> {
      return request('/api/profile');
    },
    async update(updates: { full_name?: string; avatar_url?: string | null }): Promise<Profile> {
      return request('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
  },

  // Documents
  documents: {
    async getPublic(params: { q?: string; category?: string; page?: number; limit?: number; sort?: string; order?: string } = {}): Promise<{ documents: Document[]; total: number; totalPages: number }> {
      const sp = new URLSearchParams({ public: 'true' });
      if (params.q) sp.set('q', params.q);
      if (params.category && params.category !== 'all') sp.set('category', params.category);
      if (params.page) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit));
      if (params.sort) sp.set('sort', params.sort);
      if (params.order) sp.set('order', params.order);
      return request(`/api/documents?${sp.toString()}`);
    },

    async getMine(params: { q?: string; category?: string; folderId?: string; page?: number; limit?: number } = {}): Promise<{ documents: Document[]; total: number; totalPages: number }> {
      const sp = new URLSearchParams({ public: 'false' });
      if (params.q) sp.set('q', params.q);
      if (params.category && params.category !== 'all') sp.set('category', params.category);
      if (params.folderId) sp.set('folder_id', params.folderId);
      if (params.page) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit));
      return request(`/api/documents?${sp.toString()}`);
    },

    async getById(id: string): Promise<Document> {
      return request(`/api/documents/${id}`);
    },

    async upload(formData: FormData): Promise<Document> {
      return request('/api/documents', {
        method: 'POST',
        body: formData,
      });
    },

    async update(id: string, updates: Partial<Document>): Promise<Document> {
      return request(`/api/documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async delete(id: string, permanent: boolean = false): Promise<void> {
      await request(`/api/documents/${id}?permanent=${permanent}`, {
        method: 'DELETE',
      });
    },

    async toggleLike(id: string, like: boolean): Promise<{ liked: boolean; likesCount: number }> {
      return request(`/api/documents/${id}/like`, {
        method: like ? 'POST' : 'DELETE',
      });
    },

    async toggleFavourite(id: string, favourite: boolean): Promise<{ favourited: boolean }> {
      return request(`/api/documents/${id}/favourite`, {
        method: favourite ? 'POST' : 'DELETE',
      });
    },
  },

  // Notes
  notes: {
    async list(params: { document_id?: string; notebook_id?: string; q?: string; is_favorite?: boolean } = {}): Promise<{ notes: Note[]; total: number }> {
      const sp = new URLSearchParams();
      if (params.document_id) sp.set('document_id', params.document_id);
      if (params.notebook_id) sp.set('notebook_id', params.notebook_id);
      if (params.q) sp.set('q', params.q);
      if (params.is_favorite !== undefined) sp.set('is_favorite', String(params.is_favorite));
      return request(`/api/notes?${sp.toString()}`);
    },

    async getById(id: string): Promise<Note> {
      return request(`/api/notes/${id}`);
    },

    async create(note: Partial<Note> & { title: string }): Promise<Note> {
      return request('/api/notes', {
        method: 'POST',
        body: JSON.stringify(note),
      });
    },

    async update(id: string, updates: Partial<Note>): Promise<Note> {
      return request(`/api/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async delete(id: string): Promise<void> {
      await request(`/api/notes/${id}`, { method: 'DELETE' });
    },
  },

  // Bookmarks
  bookmarks: {
    async list(documentId?: string): Promise<{ bookmarks: Bookmark[]; total: number }> {
      const sp = new URLSearchParams();
      if (documentId) sp.set('document_id', documentId);
      return request(`/api/bookmarks?${sp.toString()}`);
    },

    async create(bookmark: { document_id: string; page_number: number; title?: string; color?: string }): Promise<Bookmark> {
      return request('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify(bookmark),
      });
    },

    async delete(id: string): Promise<void> {
      await request(`/api/bookmarks/${id}`, { method: 'DELETE' });
    },
  },

  // Annotations
  annotations: {
    async list(documentId?: string, pageNumber?: number): Promise<{ annotations: Annotation[]; total: number }> {
      const sp = new URLSearchParams();
      if (documentId) sp.set('document_id', documentId);
      if (pageNumber !== undefined) sp.set('page_number', String(pageNumber));
      return request(`/api/annotations?${sp.toString()}`);
    },

    async create(annotation: { document_id: string; page_number: number; type: string; color?: string; rects?: any[]; content?: string | null }): Promise<Annotation> {
      return request('/api/annotations', {
        method: 'POST',
        body: JSON.stringify(annotation),
      });
    },

    async update(id: string, updates: { color?: string; rects?: any[]; content?: string | null }): Promise<Annotation> {
      return request(`/api/annotations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async delete(id: string): Promise<void> {
      await request(`/api/annotations/${id}`, { method: 'DELETE' });
    },
  },

  // Notebooks
  notebooks: {
    async list(): Promise<{ notebooks: Notebook[]; total: number }> {
      return request('/api/notebooks');
    },

    async getById(id: string): Promise<Notebook> {
      return request(`/api/notebooks/${id}`);
    },

    async create(data: { title: string; description?: string; color?: string; is_favorite?: boolean }): Promise<Notebook> {
      return request('/api/notebooks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(id: string, updates: Partial<Notebook>): Promise<Notebook> {
      return request(`/api/notebooks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async delete(id: string): Promise<void> {
      await request(`/api/notebooks/${id}`, { method: 'DELETE' });
    },
  },

  // Reading Progress
  readingProgress: {
    async list(documentId?: string): Promise<{ progressList: { progress: ReadingProgress; document?: Document }[]; total: number }> {
      const sp = new URLSearchParams();
      if (documentId) sp.set('document_id', documentId);
      return request(`/api/reading-progress?${sp.toString()}`);
    },

    async save(progress: {
      document_id: string;
      current_page: number;
      total_pages: number;
      percentage?: number;
      zoom_level?: number;
      view_mode?: string;
      crop_settings?: any;
      active_seconds?: number;
    }): Promise<ReadingProgress> {
      return request('/api/reading-progress', {
        method: 'POST',
        body: JSON.stringify(progress),
      });
    },
  },

  // Folders
  folders: {
    async list(): Promise<{ folders: Folder[]; total: number }> {
      return request('/api/folders');
    },

    async create(data: { name: string; color?: string; icon?: string }): Promise<Folder> {
      return request('/api/folders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(id: string, updates: { name?: string; color?: string; icon?: string }): Promise<Folder> {
      return request(`/api/folders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async delete(id: string): Promise<void> {
      await request(`/api/folders/${id}`, { method: 'DELETE' });
    },

    async addDocument(folderId: string, documentId: string): Promise<void> {
      await request(`/api/folders/${folderId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ document_id: documentId }),
      });
    },

    async removeDocument(folderId: string, documentId: string): Promise<void> {
      await request(`/api/folders/${folderId}/documents?document_id=${documentId}`, {
        method: 'DELETE',
      });
    },
  },

  // Moderation & Admin
  moderation: {
    async getData(): Promise<{ submissions: ContributionSubmission[]; reports: ContentReport[]; pendingCount: number }> {
      return request('/api/moderation');
    },

    async reviewSubmission(submissionId: string, action: 'approve' | 'reject', rejectionReason?: string): Promise<ContributionSubmission> {
      return request('/api/moderation', {
        method: 'POST',
        body: JSON.stringify({
          submission_id: submissionId,
          action,
          rejection_reason: rejectionReason,
        }),
      });
    },

    async resolveReport(reportId: string, resolutionNotes: string): Promise<ContentReport> {
      return request('/api/moderation', {
        method: 'POST',
        body: JSON.stringify({
          type: 'report_resolution',
          report_id: reportId,
          resolution_notes: resolutionNotes,
        }),
      });
    },
  },

  // Contributions
  contributions: {
    async list(): Promise<{ submissions: ContributionSubmission[]; total: number }> {
      return request('/api/contributions');
    },

    async submit(data: {
      title: string;
      description?: string;
      file_name: string;
      file_size: number;
      categories?: string[];
      tags?: string[];
      rights_declared: boolean;
    }): Promise<ContributionSubmission> {
      return request('/api/contributions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },

  // Contact
  contact: {
    async send(data: { name: string; email: string; subject: string; message: string }): Promise<any> {
      return request('/api/contact', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },
};
