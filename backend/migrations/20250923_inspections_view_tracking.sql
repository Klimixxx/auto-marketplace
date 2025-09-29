DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'inspections'
      AND column_name = 'admin_last_viewed_at'
  ) THEN
    EXECUTE 'ALTER TABLE inspections ADD COLUMN admin_last_viewed_at TIMESTAMP';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'inspections'
      AND column_name = 'user_last_viewed_at'
  ) THEN
    EXECUTE 'ALTER TABLE inspections ADD COLUMN user_last_viewed_at TIMESTAMP';
  END IF;

  BEGIN
    EXECUTE 'ALTER TABLE inspections ALTER COLUMN user_last_viewed_at SET DEFAULT now()';
  EXCEPTION
    WHEN undefined_column THEN NULL;
  END;

  UPDATE inspections
     SET admin_last_viewed_at = updated_at
   WHERE admin_last_viewed_at IS NULL;

  UPDATE inspections
     SET user_last_viewed_at = updated_at
   WHERE user_last_viewed_at IS NULL;
END $$;
