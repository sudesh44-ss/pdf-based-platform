-- ==============================================================================
-- OPENSHELF — PERFORMANCE INDEXES MIGRATION
-- ==============================================================================
-- Optimizes high-frequency catalog browsing, sorting, and category lookups.

-- 1. Index for Public Catalog Sorted by Latest (Homepage, Feed, Library)
CREATE INDEX IF NOT EXISTS idx_documents_public_catalog_sort
    ON public.documents (created_at DESC)
    WHERE is_public = true AND status = 'published' AND is_trash = false AND is_deleted = false;

-- 2. Index for Public Catalog Sorted by Popularity
CREATE INDEX IF NOT EXISTS idx_documents_public_popular_sort
    ON public.documents (likes_count DESC, created_at DESC)
    WHERE is_public = true AND status = 'published' AND is_trash = false AND is_deleted = false;

-- 3. GIN Index on categories for fast array containment queries
CREATE INDEX IF NOT EXISTS idx_documents_categories_gin
    ON public.documents USING GIN (categories)
    WHERE is_public = true AND status = 'published';

-- 4. Compound Index on Categories Table for sorted active categories
CREATE INDEX IF NOT EXISTS idx_categories_visible_name
    ON public.categories (name ASC)
    WHERE is_visible = true;
