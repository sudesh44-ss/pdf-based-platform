-- ==============================================================================
-- SMARTPDF — REMOVE OCR FUNCTIONALITY MIGRATION
-- Safely drops OCR-exclusive tables and policies.
-- Does not modify user documents, notes, bookmarks, or reading progress.
-- ==============================================================================

-- Drop policies associated with ocr_pages
DROP POLICY IF EXISTS "OCR pages viewable if document accessible" ON public.ocr_pages;

-- Drop indexes associated with ocr_pages
DROP INDEX IF EXISTS public.idx_ocr_pages_doc_page;

-- Drop table
DROP TABLE IF EXISTS public.ocr_pages CASCADE;
