-- ==============================================================================
-- OPENSHELF — TELEGRAM CENTRAL STORAGE & EXTENDED PUBLISHING WORKFLOW
-- ==============================================================================

-- 1. Extend telegram_uploads with source type, duplicate detection flags
ALTER TABLE public.telegram_uploads
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'telegram',
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of_id UUID REFERENCES public.telegram_uploads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_telegram_uploads_source_type ON public.telegram_uploads(source_type);
CREATE INDEX IF NOT EXISTS idx_telegram_uploads_is_duplicate ON public.telegram_uploads(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_telegram_uploads_duplicate_of_id ON public.telegram_uploads(duplicate_of_id);

-- 2. Extend documents table with telegram references and delete-everywhere audit fields
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_file_unique_id TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'telegram',
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_documents_telegram_file_unique_id ON public.documents(telegram_file_unique_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_deleted ON public.documents(is_deleted);
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON public.documents(source_type);
