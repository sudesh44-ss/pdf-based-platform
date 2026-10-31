-- ==============================================================================
-- OPENSHELF — LOCAL-FIRST USER DATA & CLOUD SYNC MIGRATION
-- ==============================================================================

-- 1. Reading History Table (Stores user reading session records for manual sync)
CREATE TABLE IF NOT EXISTS public.reading_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL DEFAULT 1,
    active_seconds INTEGER NOT NULL DEFAULT 0,
    read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reading_history_user ON public.reading_history(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_user_doc ON public.reading_history(user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_read_at ON public.reading_history(read_at DESC);

-- 2. User Sync Metadata (Stores last sync snapshot version per user account)
CREATE TABLE IF NOT EXISTS public.user_sync_meta (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    sync_version INTEGER NOT NULL DEFAULT 1,
    client_device_info TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Row-Level Security Policies
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sync_meta ENABLE ROW LEVEL SECURITY;

-- Reading History: Users can view and manage their own history
CREATE POLICY "Users can manage their own reading history"
    ON public.reading_history
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- User Sync Meta: Users can view and update their own sync meta
CREATE POLICY "Users can manage their own sync metadata"
    ON public.user_sync_meta
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
