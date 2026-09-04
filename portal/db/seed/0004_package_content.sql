-- socialX portal :: package content
--
-- Name, tagline, description and the included list, lifted from the deployed
-- pricing section so the site and the admin Packages screen read one source.
-- Copy is unchanged from what is live, deliberately: it is validated and the
-- Company Profile locks the tier specs.

update plans set
  tagline = 'Show up consistently and look professional, without the agency price tag.',
  description = 'Light customization. Your logo, colors, and CTAs dropped into proven, feature-targeted posts. Strong copy, wearing your brand.',
  includes = '[
    {"text":"8 posts per month (2 per week)","highlight":true},
    {"text":"2 platforms of your choice","highlight":true},
    {"text":"Scheduled to your HL Social Planner","highlight":false},
    {"text":"1 revision round per batch","highlight":false},
    {"text":"First batch live in 7 days","highlight":false}
  ]'::jsonb
where key = 'starter';

update plans set
  tagline = 'Content that sounds like you and speaks to your niche, plus custom posts and motion video.',
  description = 'Heavy customization. Rewritten in your voice, angled to your niche and the exact services your SaaS sells, with your positioning woven in. Tailored, not templated.',
  includes = '[
    {"text":"16 posts per month (12 library, 2 custom, 2 motion videos)","highlight":true},
    {"text":"2 motion videos, around 30 seconds","highlight":true},
    {"text":"3 platforms: LinkedIn, Facebook, Instagram","highlight":true},
    {"text":"Custom posts for wins, onboardings, milestones","highlight":false},
    {"text":"2 revision rounds per batch","highlight":false},
    {"text":"Monthly 30-minute content review call","highlight":true},
    {"text":"First batch live in 7 days","highlight":false}
  ]'::jsonb
where key = 'growth';

update plans set
  tagline = 'A content partner that works from your business, not a template library. Daily presence, fully bespoke.',
  description = 'Built around your business. No fixed formula. We study your offer and audience, then decide post by post: rebuild a library piece completely for you, or write one from scratch. Whatever sells your software best.',
  includes = '[
    {"text":"24 posts per month (20 static, 4 motion videos), built bespoke for you","highlight":true},
    {"text":"Motion videos run around 30 seconds","highlight":true},
    {"text":"4 platforms: LinkedIn, Facebook, Instagram, plus TikTok or X","highlight":true},
    {"text":"Real-time content for launches, wins, and feedback","highlight":false},
    {"text":"Unlimited revisions","highlight":false},
    {"text":"Monthly 30-minute strategy call","highlight":true},
    {"text":"First batch live in 5 days, priority queue","highlight":false}
  ]'::jsonb
where key = 'scale';

do $$
declare n int;
begin
  select count(*) into n from plans where includes = '[]'::jsonb or tagline is null;
  if n > 0 then
    raise exception '% plan(s) still have no package content', n;
  end if;
end $$;
