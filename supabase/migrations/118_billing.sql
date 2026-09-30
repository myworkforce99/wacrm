ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing','active','past_due','canceled','paused')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'starter'
    CHECK (plan_tier IN ('starter','growth','pro')),
  ADD COLUMN IF NOT EXISTS seat_limit INTEGER NOT NULL DEFAULT 3;
