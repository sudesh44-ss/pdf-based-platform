/**
 * OpenShelf Local-First Data Storage Engine (IndexedDB)
 *
 * Implements browser-first offline persistence for:
 * 1. Notes (Local creation, editing, deletion)
 * 2. Reading Progress (Local page tracking, active reading time)
 * 3. Reading History (Session logs, reading timestamps)
 * 4. Sync Metadata (Snapshot versions, last synced timestamps)
 *
 * Notes, Reading History, and Reading Progress are NEVER automatically uploaded.
 * They are uploaded ONLY upon explicit user "Sync Data" invocation.
 */

export interface LocalNote {
  id: string;
  user_id: string;
  document_id: string | null;
  page_number?: number | null;
  title: string;
  content_html: string;
  content_json?: any;
  tags?: string[];
  is_favorite?: boolean;
  version: number;
  client_updated_at: string;
  sync_status: 'synced' | 'dirty' | 'conflict';
  is_deleted?: boolean;
  conflict_data?: {
    server_title: string;
    server_content_html: string;
    server_updated_at: string;
  } | null;
}

export interface LocalReadingProgress {
  document_id: string;
  user_id: string;
  current_page: number;
  total_pages: number;
  percentage: number;
  zoom_level?: number;
  view_mode?: string;
  crop_settings?: any;
  active_seconds: number;
  last_read_at: string;
  client_updated_at: string;
  sync_status: 'synced' | 'dirty';
}

export interface LocalReadingHistoryEntry {
  id: string;
  user_id: string;
  document_id: string;
  document_title?: string;
  page_number: number;
  active_seconds: number;
  read_at: string;
  sync_status: 'synced' | 'dirty';
}

export interface SyncPendingSummary {
  dirtyNotes: LocalNote[];
  dirtyProgress: LocalReadingProgress[];
  dirtyHistory: LocalReadingHistoryEntry[];
  totalDirty: number;
}

const DB_NAME = 'openshelf_local_first_v1';
const DB_VERSION = 1;

// In-memory fallback storage for SSR / environments without native IndexedDB
const memoryStore = {
  notes: new Map<string, LocalNote>(),
  progress: new Map<string, LocalReadingProgress>(),
  history: new Map<string, LocalReadingHistoryEntry>(),
  meta: new Map<string, any>(),
};

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      return reject(new Error('IndexedDB unavailable'));
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('user_id', 'user_id', { unique: false });
        notesStore.createIndex('document_id', 'document_id', { unique: false });
      }

      if (!db.objectStoreNames.contains('reading_progress')) {
        // Compound key: document_id:user_id
        const progStore = db.createObjectStore('reading_progress', { keyPath: 'document_id' });
        progStore.createIndex('user_id', 'user_id', { unique: false });
      }

      if (!db.objectStoreNames.contains('reading_history')) {
        const histStore = db.createObjectStore('reading_history', { keyPath: 'id' });
        histStore.createIndex('user_id', 'user_id', { unique: false });
        histStore.createIndex('document_id', 'document_id', { unique: false });
      }

      if (!db.objectStoreNames.contains('sync_meta')) {
        db.createObjectStore('sync_meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * NOTES STORE OPERATIONS
 */
export const localNotes = {
  async list(userId: string, documentId?: string): Promise<LocalNote[]> {
    if (!hasIndexedDb()) {
      return Array.from(memoryStore.notes.values()).filter(
        (n) => n.user_id === userId && !n.is_deleted && (!documentId || n.document_id === documentId)
      );
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const req = store.getAll();

      req.onsuccess = () => {
        const list: LocalNote[] = (req.result || []).filter(
          (n: LocalNote) => n.user_id === userId && !n.is_deleted && (!documentId || n.document_id === documentId)
        );
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getById(id: string): Promise<LocalNote | null> {
    if (!hasIndexedDb()) {
      const n = memoryStore.notes.get(id);
      return n && !n.is_deleted ? n : null;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const req = store.get(id);

      req.onsuccess = () => {
        const note = req.result as LocalNote | undefined;
        resolve(note && !note.is_deleted ? note : null);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async save(note: Partial<LocalNote> & { title: string }, userId: string): Promise<LocalNote> {
    const now = new Date().toISOString();
    const existing = note.id ? await this.getById(note.id) : null;

    const saved: LocalNote = {
      id: note.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`),
      user_id: userId,
      document_id: note.document_id ?? existing?.document_id ?? null,
      page_number: note.page_number ?? existing?.page_number ?? null,
      title: note.title.trim(),
      content_html: note.content_html ?? existing?.content_html ?? '',
      content_json: note.content_json ?? existing?.content_json ?? { type: 'doc', content: [] },
      tags: note.tags ?? existing?.tags ?? [],
      is_favorite: note.is_favorite ?? existing?.is_favorite ?? false,
      version: (existing?.version || 0) + 1,
      client_updated_at: note.client_updated_at || now,
      sync_status: note.sync_status || 'dirty', // Defaults to local unsynchronized change unless specified
      is_deleted: note.is_deleted ?? false,
      conflict_data: note.conflict_data !== undefined ? note.conflict_data : (existing?.conflict_data ?? null),
    };

    if (!hasIndexedDb()) {
      memoryStore.notes.set(saved.id, saved);
      return saved;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const req = store.put(saved);

      req.onsuccess = () => resolve(saved);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;

    if (existing.sync_status === 'dirty' && existing.version === 1) {
      // Never synchronized to cloud -> hard delete locally
      if (!hasIndexedDb()) {
        memoryStore.notes.delete(id);
        return;
      }
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('notes', 'readwrite');
        const store = tx.objectStore('notes');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    // Has cloud presence -> tombstone mark as deleted so cloud sync can purge it
    const tombstone: LocalNote = {
      ...existing,
      is_deleted: true,
      sync_status: 'dirty',
      client_updated_at: new Date().toISOString(),
    };

    if (!hasIndexedDb()) {
      memoryStore.notes.set(id, tombstone);
      return;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const req = store.put(tombstone);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};

/**
 * READING PROGRESS STORE OPERATIONS
 */
export const localProgress = {
  async get(documentId: string, userId: string): Promise<LocalReadingProgress | null> {
    if (!hasIndexedDb()) {
      const p = memoryStore.progress.get(documentId);
      return p && p.user_id === userId ? p : null;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reading_progress', 'readonly');
      const store = tx.objectStore('reading_progress');
      const req = store.get(documentId);

      req.onsuccess = () => {
        const prog = req.result as LocalReadingProgress | undefined;
        resolve(prog && prog.user_id === userId ? prog : null);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(userId: string): Promise<LocalReadingProgress[]> {
    if (!hasIndexedDb()) {
      return Array.from(memoryStore.progress.values()).filter((p) => p.user_id === userId);
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reading_progress', 'readonly');
      const store = tx.objectStore('reading_progress');
      const req = store.getAll();

      req.onsuccess = () => {
        const list: LocalReadingProgress[] = (req.result || []).filter(
          (p: LocalReadingProgress) => p.user_id === userId
        );
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async save(
    progress: {
      document_id: string;
      current_page: number;
      total_pages: number;
      percentage?: number;
      zoom_level?: number;
      view_mode?: string;
      crop_settings?: any;
      active_seconds?: number;
      sync_status?: 'synced' | 'dirty';
    },
    userId: string
  ): Promise<LocalReadingProgress> {
    const existing = await this.get(progress.document_id, userId);
    const now = new Date().toISOString();

    const percentage =
      progress.percentage !== undefined
        ? progress.percentage
        : progress.total_pages > 0
        ? Math.round((progress.current_page / progress.total_pages) * 100 * 100) / 100
        : 0;

    const saved: LocalReadingProgress = {
      document_id: progress.document_id,
      user_id: userId,
      current_page: progress.current_page,
      total_pages: progress.total_pages,
      percentage,
      zoom_level: progress.zoom_level ?? existing?.zoom_level ?? 1.0,
      view_mode: progress.view_mode ?? existing?.view_mode ?? 'single',
      crop_settings: progress.crop_settings ?? existing?.crop_settings ?? null,
      active_seconds: (existing?.active_seconds || 0) + (progress.active_seconds || 0),
      last_read_at: now,
      client_updated_at: now,
      sync_status: progress.sync_status || 'dirty', // Marks local unsynchronized change unless specified
    };

    if (!hasIndexedDb()) {
      memoryStore.progress.set(saved.document_id, saved);
      return saved;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reading_progress', 'readwrite');
      const store = tx.objectStore('reading_progress');
      const req = store.put(saved);

      req.onsuccess = () => resolve(saved);
      req.onerror = () => reject(req.error);
    });
  },
};

/**
 * READING HISTORY STORE OPERATIONS
 */
export const localHistory = {
  async record(
    entry: {
      document_id: string;
      document_title?: string;
      page_number: number;
      active_seconds: number;
    },
    userId: string
  ): Promise<LocalReadingHistoryEntry> {
    const now = new Date().toISOString();
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const saved: LocalReadingHistoryEntry = {
      id,
      user_id: userId,
      document_id: entry.document_id,
      document_title: entry.document_title || 'Document',
      page_number: entry.page_number,
      active_seconds: entry.active_seconds,
      read_at: now,
      sync_status: 'dirty',
    };

    if (!hasIndexedDb()) {
      memoryStore.history.set(saved.id, saved);
      return saved;
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reading_history', 'readwrite');
      const store = tx.objectStore('reading_history');
      const req = store.put(saved);

      req.onsuccess = () => resolve(saved);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(userId: string): Promise<LocalReadingHistoryEntry[]> {
    if (!hasIndexedDb()) {
      return Array.from(memoryStore.history.values())
        .filter((h) => h.user_id === userId)
        .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime());
    }

    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('reading_history', 'readonly');
      const store = tx.objectStore('reading_history');
      const req = store.getAll();

      req.onsuccess = () => {
        const list: LocalReadingHistoryEntry[] = (req.result || [])
          .filter((h: LocalReadingHistoryEntry) => h.user_id === userId)
          .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  },
};

/**
 * SYNCHRONIZATION & CONFLICT MANAGER
 */
export const localSync = {
  async getPendingChanges(userId: string): Promise<SyncPendingSummary> {
    const [allNotes, allProgress, allHistory] = await Promise.all([
      (async () => {
        if (!hasIndexedDb()) {
          return Array.from(memoryStore.notes.values()).filter((n) => n.user_id === userId);
        }
        const db = await openDb();
        return new Promise<LocalNote[]>((resolve, reject) => {
          const tx = db.transaction('notes', 'readonly');
          const req = tx.objectStore('notes').getAll();
          req.onsuccess = () => resolve((req.result || []).filter((n: LocalNote) => n.user_id === userId));
          req.onerror = () => reject(req.error);
        });
      })(),
      localProgress.getAll(userId),
      localHistory.getAll(userId),
    ]);

    const dirtyNotes = allNotes.filter((n) => n.sync_status === 'dirty' || n.sync_status === 'conflict');
    const dirtyProgress = allProgress.filter((p) => p.sync_status === 'dirty');
    const dirtyHistory = allHistory.filter((h) => h.sync_status === 'dirty');

    return {
      dirtyNotes,
      dirtyProgress,
      dirtyHistory,
      totalDirty: dirtyNotes.length + dirtyProgress.length + dirtyHistory.length,
    };
  },

  /**
   * Applies the cloud snapshot received from the server to local storage.
   * Handles multi-device merges and detects note conflicts safely.
   */
  async applyServerSnapshot(
    userId: string,
    snapshot: {
      notes: any[];
      readingProgress: any[];
      readingHistory?: any[];
      serverTimestamp: string;
    }
  ): Promise<{ conflicts: LocalNote[]; syncedCount: number }> {
    const conflicts: LocalNote[] = [];
    let syncedCount = 0;

    // 1. Process Notes
    const existingNotes = await (async () => {
      if (!hasIndexedDb()) {
        return Array.from(memoryStore.notes.values()).filter((n) => n.user_id === userId);
      }
      const db = await openDb();
      return new Promise<LocalNote[]>((resolve, reject) => {
        const tx = db.transaction('notes', 'readonly');
        const req = tx.objectStore('notes').getAll();
        req.onsuccess = () => resolve((req.result || []).filter((n: LocalNote) => n.user_id === userId));
        req.onerror = () => reject(req.error);
      });
    })();

    const localNoteMap = new Map<string, LocalNote>(existingNotes.map((n) => [n.id, n]));

    for (const serverNote of snapshot.notes || []) {
      const local = localNoteMap.get(serverNote.id);

      if (local && local.sync_status === 'dirty') {
        // Conflict Check: Server changed while local also changed
        const serverUpdated = new Date(serverNote.updated_at || 0).getTime();
        const localUpdated = new Date(local.client_updated_at || 0).getTime();

        if (serverUpdated > 0 && Math.abs(serverUpdated - localUpdated) > 2000) {
          // Flag conflict: preserve local edits while recording server state
          local.sync_status = 'conflict';
          local.conflict_data = {
            server_title: serverNote.title,
            server_content_html: serverNote.content_html,
            server_updated_at: serverNote.updated_at,
          };
          conflicts.push(local);

          if (!hasIndexedDb()) {
            memoryStore.notes.set(local.id, local);
          } else {
            const db = await openDb();
            const tx = db.transaction('notes', 'readwrite');
            tx.objectStore('notes').put(local);
          }
          continue;
        }
      }

      // Safe update or fresh restore from server
      const restoredNote: LocalNote = {
        id: serverNote.id,
        user_id: userId,
        document_id: serverNote.document_id,
        page_number: serverNote.page_number,
        title: serverNote.title,
        content_html: serverNote.content_html,
        content_json: serverNote.content_json,
        tags: serverNote.tags || [],
        is_favorite: serverNote.is_favorite || false,
        version: 1,
        client_updated_at: serverNote.updated_at || new Date().toISOString(),
        sync_status: 'synced',
        is_deleted: false,
      };

      syncedCount++;
      if (!hasIndexedDb()) {
        memoryStore.notes.set(restoredNote.id, restoredNote);
      } else {
        const db = await openDb();
        const tx = db.transaction('notes', 'readwrite');
        tx.objectStore('notes').put(restoredNote);
      }
    }

    // 2. Process Reading Progress (Latest timestamp wins)
    for (const serverProg of snapshot.readingProgress || []) {
      const local = await localProgress.get(serverProg.document_id, userId);

      let shouldUseServer = true;
      if (local) {
        const localTime = new Date(local.last_read_at).getTime();
        const serverTime = new Date(serverProg.last_read_at).getTime();
        if (localTime > serverTime) {
          shouldUseServer = false;
        }
      }

      if (shouldUseServer) {
        const restoredProg: LocalReadingProgress = {
          document_id: serverProg.document_id,
          user_id: userId,
          current_page: serverProg.current_page,
          total_pages: serverProg.total_pages,
          percentage: Number(serverProg.percentage || 0),
          zoom_level: serverProg.zoom_level,
          view_mode: serverProg.view_mode,
          crop_settings: serverProg.crop_settings,
          active_seconds: serverProg.active_seconds || 0,
          last_read_at: serverProg.last_read_at,
          client_updated_at: serverProg.last_read_at,
          sync_status: 'synced',
        };

        if (!hasIndexedDb()) {
          memoryStore.progress.set(restoredProg.document_id, restoredProg);
        } else {
          const db = await openDb();
          const tx = db.transaction('reading_progress', 'readwrite');
          tx.objectStore('reading_progress').put(restoredProg);
        }
      }
    }

    // 3. Mark dirty history items as synced
    const historyList = await localHistory.getAll(userId);
    for (const h of historyList) {
      if (h.sync_status === 'dirty') {
        h.sync_status = 'synced';
        if (!hasIndexedDb()) {
          memoryStore.history.set(h.id, h);
        } else {
          const db = await openDb();
          const tx = db.transaction('reading_history', 'readwrite');
          tx.objectStore('reading_history').put(h);
        }
      }
    }

    // 4. Save last sync timestamp
    if (hasIndexedDb()) {
      const db = await openDb();
      const tx = db.transaction('sync_meta', 'readwrite');
      tx.objectStore('sync_meta').put({
        key: `last_synced_at:${userId}`,
        value: snapshot.serverTimestamp,
      });
    } else {
      memoryStore.meta.set(`last_synced_at:${userId}`, snapshot.serverTimestamp);
    }

    return { conflicts, syncedCount };
  },

  /**
   * "Logout Without Save":
   * Discards only unsynchronized local changes associated with the current account.
   * Preserves previous cloud copy and does not touch other accounts or browser data.
   */
  async discardUnsynced(userId: string): Promise<void> {
    // 1. Revert or delete dirty notes
    const notes = await (async () => {
      if (!hasIndexedDb()) {
        return Array.from(memoryStore.notes.values()).filter((n) => n.user_id === userId);
      }
      const db = await openDb();
      return new Promise<LocalNote[]>((resolve, reject) => {
        const tx = db.transaction('notes', 'readonly');
        const req = tx.objectStore('notes').getAll();
        req.onsuccess = () => resolve((req.result || []).filter((n: LocalNote) => n.user_id === userId));
        req.onerror = () => reject(req.error);
      });
    })();

    for (const n of notes) {
      if (n.sync_status === 'dirty' || n.sync_status === 'conflict') {
        if (!hasIndexedDb()) {
          memoryStore.notes.delete(n.id);
        } else {
          const db = await openDb();
          const tx = db.transaction('notes', 'readwrite');
          tx.objectStore('notes').delete(n.id);
        }
      }
    }

    // 2. Discard dirty progress
    const progressList = await localProgress.getAll(userId);
    for (const p of progressList) {
      if (p.sync_status === 'dirty') {
        if (!hasIndexedDb()) {
          memoryStore.progress.delete(p.document_id);
        } else {
          const db = await openDb();
          const tx = db.transaction('reading_progress', 'readwrite');
          tx.objectStore('reading_progress').delete(p.document_id);
        }
      }
    }

    // 3. Discard dirty history
    const historyList = await localHistory.getAll(userId);
    for (const h of historyList) {
      if (h.sync_status === 'dirty') {
        if (!hasIndexedDb()) {
          memoryStore.history.delete(h.id);
        } else {
          const db = await openDb();
          const tx = db.transaction('reading_history', 'readwrite');
          tx.objectStore('reading_history').delete(h.id);
        }
      }
    }
  },
};
