-- ==============================================================================
-- SMARTPDF — ADMIN, TELEGRAM UPLOADS & CATEGORIES WORKFLOW MIGRATION
-- ==============================================================================

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    icon TEXT NOT NULL DEFAULT 'folder',
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed default categories if empty
INSERT INTO public.categories (name, slug, description, color, icon)
VALUES
    ('Computer Science', 'computer-science', 'Software engineering, algorithms, architectures, and systems', '#3b82f6', 'code'),
    ('Mathematics', 'mathematics', 'Pure and applied mathematics, statistics, and analysis', '#8b5cf6', 'calculator'),
    ('Physics', 'physics', 'Theoretical, quantum, and experimental physics papers', '#ec4899', 'atom'),
    ('Engineering', 'engineering', 'Electrical, mechanical, and civil engineering guides', '#f59e0b', 'cpu'),
    ('Biology & Medicine', 'biology-medicine', 'Medical research, bioinformatics, and life sciences', '#10b981', 'activity'),
    ('History & Philosophy', 'history-philosophy', 'Historical archives, cultural philosophy, and treaties', '#6366f1', 'book'),
    ('General Reference', 'general-reference', 'Handbooks, dictionaries, specifications, and whitepapers', '#64748b', 'file-text')
ON CONFLICT (name) DO NOTHING;

-- 2. TELEGRAM UPLOADS TABLE
CREATE TABLE IF NOT EXISTS public.telegram_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_file_id TEXT NOT NULL,
    telegram_file_unique_id TEXT NOT NULL,
    telegram_chat_id BIGINT NOT NULL,
    telegram_message_id BIGINT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    file_size BIGINT NOT NULL,
    file_hash TEXT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT,
    tags TEXT[] DEFAULT '{}',
    author TEXT,
    language TEXT DEFAULT 'en',
    publication_year INTEGER,
    thumbnail_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('received', 'validating', 'pending', 'under_review', 'approved', 'rejected', 'published', 'unpublished', 'processing_failed')),
    rejection_reason TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_telegram_chat_message UNIQUE (telegram_chat_id, telegram_message_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_uploads_status ON public.telegram_uploads(status);
CREATE INDEX IF NOT EXISTS idx_telegram_uploads_file_unique_id ON public.telegram_uploads(telegram_file_unique_id);
CREATE INDEX IF NOT EXISTS idx_telegram_uploads_doc_id ON public.telegram_uploads(document_id);

-- 3. ADMIN SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON public.admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON public.admin_sessions(expires_at);

-- 4. ADMIN ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_username TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created_at ON public.admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_action ON public.admin_activity_logs(action);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Categories RLS: visible categories readable by public
CREATE POLICY "Categories viewable by everyone"
    ON public.categories FOR SELECT
    USING (is_visible = true OR public.is_admin());

CREATE POLICY "Categories manageable by admin"
    ON public.categories FOR ALL
    USING (public.is_admin());

-- Telegram uploads: ONLY viewable and manageable by admin/service role. Inaccessible to public users.
CREATE POLICY "Telegram uploads manageable by admin only"
    ON public.telegram_uploads FOR ALL
    USING (public.is_admin());

-- Admin sessions: restricted to service role / admin
CREATE POLICY "Admin sessions service role only"
    ON public.admin_sessions FOR ALL
    USING (public.is_admin());

-- Admin activity logs: restricted to admin
CREATE POLICY "Admin activity logs viewable by admin only"
    ON public.admin_activity_logs FOR ALL
    USING (public.is_admin());
