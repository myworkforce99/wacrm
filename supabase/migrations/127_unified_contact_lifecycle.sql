-- 1. Function to handle auto-deal and auto-conversation creation
CREATE OR REPLACE FUNCTION on_contact_created_lifecycle()
RETURNS TRIGGER AS $$
DECLARE
  v_conv_id UUID;
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_deal_title TEXT;
BEGIN
  -- Auto-Conversation: create one if it doesn't exist
  -- (It might already exist if a webhook raced and created it first, but usually contacts triggers first)
  SELECT id INTO v_conv_id FROM conversations WHERE contact_id = NEW.id AND account_id = NEW.account_id LIMIT 1;
  IF v_conv_id IS NULL THEN
    INSERT INTO conversations (account_id, contact_id, user_id)
    VALUES (NEW.account_id, NEW.id, NEW.user_id)
    RETURNING id INTO v_conv_id;
  END IF;

  -- Auto-Deal: find default pipeline and insert
  SELECT id INTO v_pipeline_id FROM pipelines WHERE account_id = NEW.account_id ORDER BY created_at ASC LIMIT 1;
  IF v_pipeline_id IS NOT NULL THEN
    SELECT id INTO v_stage_id FROM pipeline_stages WHERE pipeline_id = v_pipeline_id ORDER BY position ASC LIMIT 1;
    IF v_stage_id IS NOT NULL THEN
      v_deal_title := COALESCE(NEW.name, NEW.phone, 'New Deal');
      
      -- Check if deal already exists (just in case)
      IF NOT EXISTS (SELECT 1 FROM deals WHERE contact_id = NEW.id AND account_id = NEW.account_id) THEN
        INSERT INTO deals (account_id, user_id, contact_id, pipeline_id, stage_id, title)
        VALUES (NEW.account_id, NEW.user_id, NEW.id, v_pipeline_id, v_stage_id, v_deal_title);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_created_lifecycle_trigger ON contacts;
CREATE TRIGGER contact_created_lifecycle_trigger
AFTER INSERT ON contacts
FOR EACH ROW
EXECUTE FUNCTION on_contact_created_lifecycle();


-- 2. Sync assignment: Conversation (user_id) -> Deal (profiles.id)
CREATE OR REPLACE FUNCTION sync_deal_assignee_from_conversation()
RETURNS TRIGGER AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Only update open deals to avoid overwriting historical won/lost records
  UPDATE deals
  SET assigned_to = (
    SELECT id FROM profiles WHERE user_id = NEW.assigned_agent_id LIMIT 1
  )
  WHERE contact_id = NEW.contact_id AND status = 'open';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_deal_assignee_trigger ON conversations;
CREATE TRIGGER sync_deal_assignee_trigger
AFTER UPDATE OF assigned_agent_id ON conversations
FOR EACH ROW
WHEN (OLD.assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id)
EXECUTE FUNCTION sync_deal_assignee_from_conversation();


-- 3. Sync assignment: Deal (profiles.id) -> Conversation (user_id)
CREATE OR REPLACE FUNCTION sync_conversation_assignee_from_deal()
RETURNS TRIGGER AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Only sync back if the deal being updated is open
  IF NEW.status = 'open' THEN
    UPDATE conversations
    SET assigned_agent_id = (
      SELECT user_id FROM profiles WHERE id = NEW.assigned_to LIMIT 1
    )
    WHERE contact_id = NEW.contact_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_conversation_assignee_trigger ON deals;
CREATE TRIGGER sync_conversation_assignee_trigger
AFTER UPDATE OF assigned_to ON deals
FOR EACH ROW
WHEN (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
EXECUTE FUNCTION sync_conversation_assignee_from_deal();


-- 4. Backfill existing data
DO $$
DECLARE
  rec RECORD;
  v_pipeline_id UUID;
  v_stage_id UUID;
  v_deal_title TEXT;
BEGIN
  -- Backfill conversations
  FOR rec IN SELECT * FROM contacts WHERE id NOT IN (SELECT contact_id FROM conversations) LOOP
    INSERT INTO conversations (account_id, contact_id, user_id)
    VALUES (rec.account_id, rec.id, rec.user_id);
  END LOOP;

  -- Backfill deals
  FOR rec IN SELECT * FROM contacts WHERE id NOT IN (SELECT contact_id FROM deals) LOOP
    SELECT id INTO v_pipeline_id FROM pipelines WHERE account_id = rec.account_id ORDER BY created_at ASC LIMIT 1;
    IF v_pipeline_id IS NOT NULL THEN
      SELECT id INTO v_stage_id FROM pipeline_stages WHERE pipeline_id = v_pipeline_id ORDER BY position ASC LIMIT 1;
      IF v_stage_id IS NOT NULL THEN
        v_deal_title := COALESCE(rec.name, rec.phone, 'New Deal');
        INSERT INTO deals (account_id, user_id, contact_id, pipeline_id, stage_id, title)
        VALUES (rec.account_id, rec.user_id, rec.id, v_pipeline_id, v_stage_id, v_deal_title);
      END IF;
    END IF;
  END LOOP;

  -- Backfill sync (Prefer conversation assignee over deal assignee, since chat routing rules act there)
  FOR rec IN 
    SELECT c.contact_id, c.assigned_agent_id, p.id as profile_id
    FROM conversations c
    JOIN profiles p ON p.user_id = c.assigned_agent_id
    WHERE c.assigned_agent_id IS NOT NULL
  LOOP
    UPDATE deals SET assigned_to = rec.profile_id WHERE contact_id = rec.contact_id AND status = 'open' AND (assigned_to IS NULL OR assigned_to != rec.profile_id);
  END LOOP;
END;
$$;
