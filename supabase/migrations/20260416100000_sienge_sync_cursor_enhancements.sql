-- Add requires_full_sync and updated_at to sienge_sync_cursor
ALTER TABLE public.sienge_sync_cursor
ADD COLUMN requires_full_sync BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create a trigger to update the updated_at column automatically
CREATE OR REPLACE FUNCTION public.update_sienge_sync_cursor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sienge_sync_cursor_updated_at_trigger
BEFORE UPDATE ON public.sienge_sync_cursor
FOR EACH ROW
EXECUTE FUNCTION public.update_sienge_sync_cursor_updated_at();
