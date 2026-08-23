/**
 * The demo client: FlowStack Pro, the Nathan Cole persona from the ICP made real
 * enough to click through.
 *
 * Three months of delivery, deliberately in three different states, because the
 * screens that matter only show their real shape when there is something in each:
 * a closed month proves the calendar and the history, a month in review proves the
 * approval loop, and a month in production proves the builder has work waiting.
 */

const PLATFORMS = ["linkedin", "facebook", "instagram"];

export async function seedClient({ db, lib, DEMO_SLUG, DEMO_EMAIL, ALSO_ADMIT, iso, day, monthStart, monthEnd }) {
  /* ---------------- organization ---------------- */
  const { data: org } = await db
    .from("organizations")
    .insert({
      name: "FlowStack Pro",
      slug: DEMO_SLUG,
      status: "active",
      source: "manual",
      hl_location_id: "demo_loc_flowstack",
      owner_email: DEMO_EMAIL,
      owner_name: "Nathan Cole",
      owner_phone: "+1 813 555 0148",
    })
    .select("id")
    .single();

  /* ---------------- people ---------------- */
  const { data: created } = await db.auth.admin.createUser({
    email: DEMO_EMAIL,
    email_confirm: true,
    user_metadata: { full_name: "Nathan Cole" },
  });
  const nathanId = created?.user?.id ?? null;

  if (nathanId) {
    await db.from("profiles").update({ full_name: "Nathan Cole", phone: "+1 813 555 0148" }).eq("id", nathanId);
    await db.from("memberships").insert({ org_id: org.id, user_id: nathanId, role: "owner" });
  }

  /* Staff who should be able to open the client portal and look at it. */
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const email of ALSO_ADMIT) {
    const u = users?.users?.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) {
      await db.from("memberships").insert({ org_id: org.id, user_id: u.id, role: "manager" }).then(
        () => undefined,
        () => undefined
      );
    }
  }

  /* ---------------- brand ---------------- */
  await db.from("brand_profiles").insert({
    org_id: org.id,
    brand_name: "FlowStack Pro",
    website: "https://flowstackpro.demo",
    colors: { primary: "#0F766E", secondary: "#14B8A6" },
    voice_notes:
      "Plain and direct. Talks to owner-operators who are busy, not to marketers. No hype, no exclamation marks, no talk of crushing it.",
    positioning:
      "A white-label HighLevel platform sold to roofing and HVAC companies at $297 a month, replacing five tools they already pay for.",
    icp_notes:
      "Owner-operators, 5 to 40 staff, mostly referral led, usually running one office manager who answers the phone.",
    niches: ["roofing", "HVAC", "plumbing"],
    banned_words: ["crush it", "game changer", "synergy", "ninja"],
    approver_name: "Nathan Cole",
    approver_email: DEMO_EMAIL,
    completed_at: iso(new Date(Date.now() - 62 * 86400000)),
  });

  for (const p of PLATFORMS) {
    await db.from("brand_platforms").insert({
      org_id: org.id,
      platform: p,
      handle: p === "linkedin" ? "flowstack-pro" : "@flowstackpro",
      hl_account_ref: `demo_${p}`,
      is_active: true,
    });
  }

  /* ---------------- subscription and invoices ---------------- */
  const { data: plan } = await db.from("plans").select("id").eq("key", "growth").single();
  const { data: ent } = await db
    .from("plan_entitlements")
    .select("posts_per_month, motion_videos, platforms_max, revision_rounds")
    .eq("plan_id", plan.id)
    .single();

  const periodStart = new Date(Date.now() - 30 * 86400000);
  const periodEnd = new Date(periodStart.getTime() + 90 * 86400000);

  await db.from("subscriptions").insert({
    org_id: org.id,
    plan_id: plan.id,
    cycle_key: "quarterly",
    rate_card_key: "launch",
    stripe_customer_id: "cus_demo_flowstack",
    stripe_subscription_id: "sub_demo_flowstack",
    status: "active",
    current_period_start: iso(periodStart),
    current_period_end: iso(periodEnd),
    started_at: iso(new Date(Date.now() - 121 * 86400000)),
    addon_keys: ["rush_first_batch"],
  });

  for (let i = 0; i < 2; i++) {
    const issued = new Date(Date.now() - (121 - i * 90) * 86400000);
    await db.from("invoices").insert({
      org_id: org.id,
      stripe_invoice_id: `in_demo_flowstack_${i + 1}`,
      number: `SX-2026-0${i + 1}4`,
      amount_due: i === 0 ? 93070 : 83370,
      amount_paid: i === 0 ? 93070 : 83370,
      status: "paid",
      period_start: iso(issued),
      period_end: iso(new Date(issued.getTime() + 90 * 86400000)),
      issued_at: iso(issued),
    });
  }

  /* ---------------- three months of delivery ---------------- */
  const MONTHS = [
    { offset: -1, status: "closed", postStatus: "published" },
    { offset: 0, status: "in_review", postStatus: "in_review" },
    { offset: 1, status: "in_production", postStatus: "in_production" },
  ];

  let postCount = 0;
  const madeBatches = [];

  for (const m of MONTHS) {
    const start = monthStart(m.offset);
    const end = monthEnd(m.offset);

    const { data: batch } = await db
      .from("batches")
      .insert({
        org_id: org.id,
        period_start: day(start),
        period_end: day(end),
        status: m.status,
        due_at: iso(new Date(start.getTime() + 6 * 86400000)),
        quota_posts: ent.posts_per_month,
        quota_motion: ent.motion_videos,
        quota_platforms: ent.platforms_max,
        revision_rounds_allowed: ent.revision_rounds,
        revision_rounds_used: m.offset === -1 ? 1 : 0,
        submitted_at: m.status === "in_production" ? null : iso(new Date(start.getTime() + 5 * 86400000)),
        approved_at: m.status === "closed" ? iso(new Date(start.getTime() + 6 * 86400000)) : null,
        closed_at: m.status === "closed" ? iso(end) : null,
      })
      .select("id")
      .single();

    madeBatches.push({ id: batch.id, status: m.status, start });

    /* 16 posts: 12 from the library, 2 written for them, 2 motion. */
    for (let i = 0; i < ent.posts_per_month; i++) {
      const isMotion = i >= ent.posts_per_month - ent.motion_videos;
      const isCustom = !isMotion && i >= ent.posts_per_month - ent.motion_videos - 2;
      const source = lib.created[i % lib.created.length];

      /* Roughly every other weekday, so the calendar reads like a real cadence. */
      const scheduled = new Date(start.getTime() + (i * 2 + 1) * 86400000);
      if (scheduled > end) scheduled.setTime(end.getTime() - 86400000);

      const platforms = isMotion
        ? ["instagram", "facebook"]
        : PLATFORMS.slice(0, (i % 3) + 1);

      const title = isCustom
        ? ["Nathan on why he stopped selling software", "The roofing client who booked 14 jobs in a week"][
            i % 2
          ]
        : isMotion
          ? `${source.title} (motion)`
          : source.title;

      const { data: post } = await db
        .from("posts")
        .insert({
          batch_id: batch.id,
          org_id: org.id,
          template_version_id: isCustom ? null : source.versionId,
          is_custom: isCustom,
          title,
          format: isMotion ? "motion" : "static",
          pillar_key: isCustom ? "social_proof" : source.pillar,
          copy: isCustom
            ? "A FlowStack Pro client in Tampa took 14 roofing jobs off one week of missed call text backs. Nothing about the offer changed. The phone just stopped going unanswered."
            : `${source.title}\n\nFor roofing and HVAC operators who are still answering the phone themselves. FlowStack Pro handles the part that happens after the call.`,
          design_asset_id: lib.assetIds[i % lib.assetIds.length] ?? null,
          platforms,
          scheduled_for: iso(scheduled),
          status: i === 3 && m.status === "in_review" ? "changes_requested" : m.postStatus,
          position: i,
        })
        .select("id")
        .single();

      if (post) {
        postCount++;
        for (const p of platforms) {
          await db.from("post_platform_copy").insert({
            post_id: post.id,
            platform: p,
            copy:
              p === "linkedin"
                ? `${title}\n\nWritten for operators, not marketers.`
                : `${title}`,
            asset_id: lib.assetIds[i % lib.assetIds.length] ?? null,
          });
        }

        /* A conversation on the month awaiting approval, so the thread is not empty. */
        if (m.status === "in_review" && i === 3) {
          await db.from("comments").insert({
            post_id: post.id,
            author_id: nathanId,
            body: "Can we swap the opening line? We do not say 'lost job' to roofers, they hear it as blame.",
            is_internal: false,
          });
          await db.from("comments").insert({
            post_id: post.id,
            body: "Good catch. Reworded and back in the batch.",
            is_internal: false,
          });
          await db.from("comments").insert({
            post_id: post.id,
            body: "Nathan is sensitive about blame framing. Worth noting on the brand profile.",
            is_internal: true,
          });
        }
      }
    }

    /* A resolved revision round on the closed month. */
    if (m.status === "closed") {
      const { data: firstPost } = await db.from("posts").select("id").eq("batch_id", batch.id).limit(1).single();
      await db.from("revisions").insert({
        batch_id: batch.id,
        post_id: firstPost?.id ?? null,
        round: 1,
        requested_by: nathanId,
        note: "Second post reads too much like a feature list. Can it open on the customer instead?",
        status: "resolved",
        resolved_at: iso(new Date(start.getTime() + 6 * 86400000)),
      });
    }

    /* An open one on the month in review, so the admin queue has work in it. */
    if (m.status === "in_review") {
      const { data: p4 } = await db.from("posts").select("id").eq("batch_id", batch.id).eq("position", 3).maybeSingle();
      await db.from("revisions").insert({
        batch_id: batch.id,
        post_id: p4?.id ?? null,
        round: 1,
        requested_by: nathanId,
        note: "Swap the opening line on this one. Roofers hear 'lost job' as blame.",
        status: "open",
      });
    }
  }

  /* ---------------- activity ---------------- */
  const events = [
    ["subscription", "provisioned", 121],
    ["brand_profile", "onboarding_completed", 62],
    ["batch", "submitted", 34],
    ["batch", "approved_by_client", 33],
    ["batch", "scheduled_to_hl", 32],
    ["batch", "submitted", 4],
    ["batch", "changes_requested", 2],
  ];
  for (const [entity, action, daysAgo] of events) {
    await db.from("activity_log").insert({
      actor_id: nathanId,
      org_id: org.id,
      entity,
      action,
      created_at: iso(new Date(Date.now() - daysAgo * 86400000)),
    });
  }

  return [
    `Client: FlowStack Pro (${DEMO_EMAIL})`,
    `  3 batches, ${postCount} posts, 2 invoices, 3 platforms`,
    `  1 batch awaiting approval, 1 open revision, 3 comments`,
  ].join("\n");
}
