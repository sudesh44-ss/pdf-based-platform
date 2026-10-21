-- ==============================================================================
-- SMART PDF PLATFORM — DATABASE SCHEMA & RLS MIGRATION
-- Tables: profiles, documents, folders, document_folders, notebooks, notes,
--         bookmarks, annotations, reading_progress, ocr_pages, likes,
--         favourites, contribution_submissions, backup_jobs, backup_items,
--         moderation_events, content_reports
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. DOCUMENTS
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash TEXT,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    page_count INTEGER NOT NULL DEFAULT 1,
    cover_image_url TEXT,
    storage_type TEXT NOT NULL DEFAULT 'telegram' CHECK (storage_type IN ('telegram', 'r2', 'local', 'supabase')),
    storage_file_id TEXT, -- Telegram file_id or R2 key
    storage_file_path TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'processing', 'pending_review', 'published', 'rejected', 'failed', 'archived')),
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    likes_count INTEGER NOT NULL DEFAULT 0,
    views_count INTEGER NOT NULL DEFAULT 0,
    is_trash BOOLEAN NOT NULL DEFAULT false,
    trashed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. FOLDERS
CREATE TABLE IF NOT EXISTS public.folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT 'folder',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. DOCUMENT_FOLDERS
CREATE TABLE IF NOT EXISTS public.document_folders (
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (document_id, folder_id)
);

-- 5. NOTEBOOKS
CREATE TABLE IF NOT EXISTS public.notebooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#8b5cf6',
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. NOTES
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notebook_id UUID REFERENCES public.notebooks(id) ON DELETE SET NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER,
    title TEXT NOT NULL DEFAULT 'Untitled Note',
    content_json JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}',
    content_html TEXT NOT NULL DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    selected_text TEXT,
    highlight_coords JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. BOOKMARKS
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    title TEXT,
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, document_id, page_number)
);

-- 8. ANNOTATIONS
CREATE TABLE IF NOT EXISTS public.annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('highlight', 'underline', 'note', 'box', 'freehand')),
    color TEXT NOT NULL DEFAULT '#fef08a',
    rects JSONB NOT NULL DEFAULT '[]', -- array of normalized bounding boxes {x, y, w, h}
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. READING_PROGRESS
CREATE TABLE IF NOT EXISTS public.reading_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    current_page INTEGER NOT NULL DEFAULT 1,
    total_pages INTEGER NOT NULL DEFAULT 1,
    percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    zoom_level NUMERIC(4,2) DEFAULT 1.00,
    view_mode TEXT DEFAULT 'single' CHECK (view_mode IN ('single', 'double', 'continuous')),
    crop_settings JSONB DEFAULT NULL,
    active_seconds INTEGER NOT NULL DEFAULT 0,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, document_id)
);

-- 10. OCR_PAGES
CREATE TABLE IF NOT EXISTS public.ocr_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    extracted_text TEXT DEFAULT '',
    confidence NUMERIC(5,2) DEFAULT 0.00,
    language TEXT NOT NULL DEFAULT 'eng',
    words_data JSONB DEFAULT '[]',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(document_id, page_number)
);

-- 11. LIKES
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, document_id)
);

-- 12. FAVOURITES
CREATE TABLE IF NOT EXISTS public.favourites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, document_id)
);

-- 13. CONTRIBUTION_SUBMISSIONS
CREATE TABLE IF NOT EXISTS public.contribution_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    rights_declared BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('draft', 'processing', 'pending_review', 'published', 'rejected', 'failed')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. BACKUP_JOBS
CREATE TABLE IF NOT EXISTS public.backup_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    destination TEXT NOT NULL DEFAULT 'telegram' CHECK (destination IN ('telegram', 'r2', 'local')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_items INTEGER NOT NULL DEFAULT 0,
    successful_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    error_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 15. BACKUP_ITEMS
CREATE TABLE IF NOT EXISTS public.backup_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.backup_jobs(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    telegram_message_id BIGINT,
    telegram_file_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 16. MODERATION_EVENTS
CREATE TABLE IF NOT EXISTS public.moderation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES public.contribution_submissions(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'remove', 'warning', 'restore')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 17. CONTENT_REPORTS
CREATE TABLE IF NOT EXISTS public.content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('copyright', 'inappropriate', 'corrupted', 'spam', 'other')),
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_documents_public_published ON public.documents (is_public, status) WHERE is_public = true AND status = 'published';
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents (user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_doc ON public.notes (user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_notes_notebook ON public.notes (notebook_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_doc ON public.bookmarks (user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_user_doc ON public.annotations (user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_ocr_pages_doc_page ON public.ocr_pages (document_id, page_number);
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_doc ON public.reading_progress (user_id, document_id);

-- Full text search index on documents title & description
CREATE INDEX IF NOT EXISTS idx_documents_fts ON public.documents USING GIN (to_tsvector('english', title || ' ' || coalesce(description, '')));

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Users can view their own profile, admins can view all
CREATE POLICY "Profiles viewable by owner or admin"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Documents: Public documents readable by all; private documents only readable by owner; admins can view all
CREATE POLICY "Public documents are viewable by everyone"
    ON public.documents FOR SELECT
    USING ((is_public = true AND status = 'published' AND is_trash = false) OR (auth.uid() = user_id) OR public.is_admin());

CREATE POLICY "Users can insert own documents"
    ON public.documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
    ON public.documents FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can delete own documents"
    ON public.documents FOR DELETE
    USING (auth.uid() = user_id OR public.is_admin());

-- Notes: Strictly private to user
CREATE POLICY "Notes accessible only by owner"
    ON public.notes FOR ALL
    USING (auth.uid() = user_id);

-- Notebooks: Strictly private to user
CREATE POLICY "Notebooks accessible only by owner"
    ON public.notebooks FOR ALL
    USING (auth.uid() = user_id);

-- Folders: Strictly private to user
CREATE POLICY "Folders accessible only by owner"
    ON public.folders FOR ALL
    USING (auth.uid() = user_id);

-- Bookmarks & Annotations: Strictly private to user
CREATE POLICY "Bookmarks accessible only by owner"
    ON public.bookmarks FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Annotations accessible only by owner"
    ON public.annotations FOR ALL
    USING (auth.uid() = user_id);

-- Reading progress: Strictly private to user
CREATE POLICY "Reading progress accessible only by owner"
    ON public.reading_progress FOR ALL
    USING (auth.uid() = user_id);

-- OCR pages: Viewable if document is viewable
CREATE POLICY "OCR pages viewable if document accessible"
    ON public.ocr_pages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = ocr_pages.document_id
            AND ((d.is_public = true AND d.status = 'published') OR d.user_id = auth.uid() OR public.is_admin())
        )
    );

-- Likes: Readable by everyone, insert/delete only by authenticated owner
CREATE POLICY "Likes viewable by everyone"
    ON public.likes FOR SELECT
    USING (true);

CREATE POLICY "Users can insert own like"
    ON public.likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own like"
    ON public.likes FOR DELETE
    USING (auth.uid() = user_id);

-- Favourites: Only readable & writeable by user
CREATE POLICY "Favourites accessible only by owner"
    ON public.favourites FOR ALL
    USING (auth.uid() = user_id);

-- Submissions: User can view and submit their own; moderators can view and update all
CREATE POLICY "Users view own submissions, moderators view all"
    ON public.contribution_submissions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users create submissions"
    ON public.contribution_submissions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Moderators update submissions"
    ON public.contribution_submissions FOR UPDATE
    USING (public.is_admin());
