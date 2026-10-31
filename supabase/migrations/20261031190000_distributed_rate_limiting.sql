-- ==============================================================================
-- OPENSHELF — DISTRIBUTED RATE LIMITING MIGRATION
-- ==============================================================================
-- Persistent, atomic rate limiting table and function for multi-instance Vercel Serverless deployments.

-- 1. RATE LIMITS TABLE
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on expires_at for efficient pruning of expired windows
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits (expires_at);

-- Enable Row Level Security (Service role only - internal operational data)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'rate_limits' AND policyname = 'Service role full access on rate_limits'
    ) THEN
        CREATE POLICY "Service role full access on rate_limits"
            ON public.rate_limits
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 2. ATOMIC RATE LIMIT CHECK FUNCTION
-- Uses row-level lock on the key row during upsert to guarantee atomic increments
-- across distributed serverless function invocations without race conditions.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS TABLE (
    allowed BOOLEAN,
    remaining INTEGER,
    reset_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_expires_at TIMESTAMPTZ;
    v_current_count INTEGER;
BEGIN
    -- Opportunistic pruning of records expired more than 5 minutes ago (batch of 100)
    DELETE FROM public.rate_limits
    WHERE key IN (
        SELECT key FROM public.rate_limits
        WHERE expires_at < v_now - interval '5 minutes'
        LIMIT 100
    );

    -- Atomic upsert: row-level lock on key
    INSERT INTO public.rate_limits (key, count, window_start, expires_at, updated_at)
    VALUES (p_key, 1, v_now, v_now + (p_window_seconds || ' seconds')::interval, v_now)
    ON CONFLICT (key) DO UPDATE
    SET
        count = CASE
            WHEN public.rate_limits.expires_at <= v_now THEN 1
            ELSE public.rate_limits.count + 1
        END,
        window_start = CASE
            WHEN public.rate_limits.expires_at <= v_now THEN v_now
            ELSE public.rate_limits.window_start
        END,
        expires_at = CASE
            WHEN public.rate_limits.expires_at <= v_now THEN v_now + (p_window_seconds || ' seconds')::interval
            ELSE public.rate_limits.expires_at
        END,
        updated_at = v_now
    RETURNING public.rate_limits.count, public.rate_limits.expires_at
    INTO v_current_count, v_expires_at;

    reset_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_expires_at - v_now))::INTEGER);

    IF v_current_count <= p_limit THEN
        allowed := TRUE;
        remaining := p_limit - v_current_count;
    ELSE
        allowed := FALSE;
        remaining := 0;
    END IF;

    RETURN NEXT;
END;
$$;

-- Grant execution to service_role
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
