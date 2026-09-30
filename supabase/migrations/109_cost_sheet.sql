ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS cost_sheet_template_id UUID REFERENCES quick_replies(id) ON DELETE SET NULL;

DO $$ 
DECLARE 
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'quick_replies'::regclass AND contype = 'c' AND conname LIKE '%kind%';
  
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE quick_replies DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

ALTER TABLE quick_replies 
  ADD CONSTRAINT quick_replies_kind_check 
  CHECK (kind IN ('text', 'interactive', 'cost_sheet'));
