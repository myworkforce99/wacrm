-- ============================================================
-- 125_agent_scoped_tag_filter.sql
--
-- Extends filter_contacts_by_tags with an optional
-- p_agent_user_id parameter. When provided, the result is
-- narrowed to contacts that:
--   1. Were created by the agent (contacts.user_id), OR
--   2. Have at least one deal assigned to the agent
--      (deals.assigned_to)
--
-- This ensures agents cannot use tag filters to browse
-- contacts that belong to other team members.
--
-- Backwards-compatible: callers that omit p_agent_user_id
-- (NULL default) see no change in behavior.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION public.filter_contacts_by_tags(
  p_tag_ids       UUID[],
  p_search        TEXT    DEFAULT NULL,
  p_limit         INT     DEFAULT 25,
  p_offset        INT     DEFAULT 0,
  p_agent_user_id UUID    DEFAULT NULL
)
RETURNS TABLE (contact contacts, total_count BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH agent_contact_ids AS (
    -- When called with an agent scope, collect the set of
    -- contact IDs the agent may see before the tag join.
    -- NULL p_agent_user_id means "no restriction" (admin/owner).
    SELECT c.id
    FROM contacts c
    WHERE p_agent_user_id IS NOT NULL
      AND (
        c.user_id = p_agent_user_id
        OR EXISTS (
          SELECT 1 FROM deals d
          WHERE d.contact_id = c.id
            AND d.assigned_to = p_agent_user_id
        )
      )
  ),
  matched AS (
    -- Distinct contacts having ANY of the selected tags (OR),
    -- narrowed by the optional name/phone/email search, and
    -- further scoped to the agent's contacts when applicable.
    SELECT DISTINCT c.id, c.created_at
    FROM contacts c
    JOIN contact_tags ct ON ct.contact_id = c.id
    WHERE ct.tag_id = ANY(p_tag_ids)
      AND (
        p_search IS NULL
        OR c.name  ILIKE '%' || p_search || '%'
        OR c.phone ILIKE '%' || p_search || '%'
        OR c.email ILIKE '%' || p_search || '%'
      )
      -- Agent scope: only include contacts in the agent's set,
      -- OR skip the restriction when no agent filter is given.
      AND (
        p_agent_user_id IS NULL
        OR c.id IN (SELECT id FROM agent_contact_ids)
      )
  ),
  page AS (
    -- count(*) OVER() is evaluated before LIMIT, so it is the full
    -- match total regardless of the page being returned.
    SELECT id, count(*) OVER() AS total_count
    FROM matched
    ORDER BY created_at DESC, id
    LIMIT p_limit OFFSET p_offset
  )
  SELECT c AS contact, page.total_count
  FROM page
  JOIN contacts c ON c.id = page.id
  ORDER BY c.created_at DESC, c.id;
$$;

ALTER FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.filter_contacts_by_tags(UUID[], TEXT, INT, INT, UUID) TO authenticated;
