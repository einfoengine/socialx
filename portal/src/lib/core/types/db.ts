/**
 * Hand-written database types for R0.
 *
 * Replace with generated types once the Supabase project exists:
 *   pnpm dlx supabase gen types typescript --project-id <ref> > lib/types/supabase.ts
 * These stay as the hand-maintained aliases the app actually imports.
 */

export type OrgStatus = "pending" | "onboarding" | "active" | "paused" | "churned";
export type MemberRole = "owner" | "manager" | "viewer";
export type StaffRole = "owner" | "ops" | "content" | "finance";
export type SubStatus =
  | "incomplete" | "trialing" | "active" | "past_due" | "paused" | "canceled";

export type MediaProvider = "highlevel" | "supabase" | "external";
export type TemplateFormat = "static" | "motion";

export type PlatformKind =
  | "linkedin" | "facebook" | "instagram" | "tiktok"
  | "x" | "hl_community" | "youtube" | "other";

export type BatchStatus =
  | "draft" | "in_production" | "in_review" | "changes_requested"
  | "approved" | "scheduling" | "live" | "closed";

export type PostStatus =
  | "draft" | "in_production" | "in_review" | "changes_requested"
  | "approved" | "scheduled" | "published" | "failed" | "skipped";

export type PlanKey = "starter" | "growth" | "scale";
export type CycleKey = "monthly" | "quarterly" | "half" | "yearly";
export type RateCardKey = "regular" | "launch";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  source: string;
  hl_location_id: string | null;
  owner_email: string | null;
  parent_org_id: string | null;
  created_at: string;
};

export type PlanEntitlements = {
  plan_id: string;
  posts_per_month: number;
  motion_videos: number;
  platforms_max: number;
  /** null means unlimited, which is Scale. Not zero, and not a large number. */
  revision_rounds: number | null;
  first_batch_days: number;
  customization_level: "light" | "heavy" | "bespoke";
  monthly_call: boolean;
};

export type PlanPrice = {
  id: string;
  plan_id: string;
  cycle_key: CycleKey;
  rate_card_key: RateCardKey;
  discount_pct: number;
  /** Effective per-month rate in cents, after discount. */
  monthly_amount: number;
  /** What Stripe charges per cycle, in cents. */
  total_amount: number;
  currency: string;
  stripe_price_id: string | null;
  is_active: boolean;
};

export type Asset = {
  id: string;
  org_id: string | null;
  provider: MediaProvider;
  url: string | null;
  hl_location_id: string | null;
  hl_file_id: string | null;
  bucket: string | null;
  path: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  bytes: number | null;
  alt: string | null;
  checksum: string | null;
  last_verified_at: string | null;
  is_broken: boolean;
  created_by: string | null;
  created_at: string;
};

export type Batch = {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  status: BatchStatus;
  due_at: string | null;
  quota_posts: number;
  quota_motion: number;
  quota_platforms: number;
  revision_rounds_allowed: number | null;
  revision_rounds_used: number;
  assigned_to: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  batch_id: string;
  org_id: string;
  template_version_id: string | null;
  is_custom: boolean;
  title: string | null;
  format: TemplateFormat;
  pillar_key: string | null;
  copy: string | null;
  design_asset_id: string | null;
  platforms: PlatformKind[];
  scheduled_for: string | null;
  status: PostStatus;
  position: number;
  created_by: string | null;
  created_at: string;
};
