-- socialX portal :: R1 :: a design on every template version
--
-- The library list already rendered a thumbnail, pulled from whichever platform
-- variant happened to carry an asset. That was a stand-in. A template's design is
-- not a property of its LinkedIn variant, and a template with no variants yet had
-- no way to show anything at all.
--
-- The column goes on template_versions rather than on templates, and that is the
-- whole decision worth recording here. Copy is versioned because a post points at
-- the version it was built from; the design is the other half of the same post. If
-- the image sat on the template, then replacing artwork would retroactively change
-- how every historical post looked, which is exactly the rewrite that versioning
-- exists to prevent. On the version, v2 can carry new artwork while a client post
-- built from v1 keeps showing what was actually delivered.
--
-- template_variants.asset_id stays. It is now what it always read like: a
-- per-platform override for the cases where a square crop and a portrait crop are
-- genuinely different files. The version asset is the default the variants depart
-- from.

alter table template_versions
  add column asset_id uuid references assets(id) on delete set null;

comment on column template_versions.asset_id is
  'The design for this version of the copy. Per-platform overrides live on template_variants; this is what they fall back to.';

create index template_versions_asset_idx on template_versions (asset_id)
  where asset_id is not null;

-- Storage for direct uploads ---------------------------------------------------
--
-- Media has always been hybrid: HighLevel hosts the bytes and socialX stores the
-- link, with Supabase named in the DAL as the second provider "for quick adds".
-- The resolver has handled provider='supabase' since R0, signing a URL per object.
-- What never existed was a bucket to put anything in, so the quick-add path was
-- unreachable and the only way to attach an image was to get it into HighLevel
-- first and wait for a sync.
--
-- This creates it. Private, because a signed URL is the point: an asset in here is
-- socialX IP and should not be a public link that outlives the session that
-- rendered it.
--
-- Guarded, because the storage schema belongs to the Supabase platform rather than
-- to this project. On a plain Postgres without it, the column above still applies
-- and the app falls back to the two link-based paths, which is a degraded upload
-- button rather than a failed migration.

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    raise notice 'No storage schema here, skipping the library bucket. Uploads will be unavailable; URL and HighLevel attachment still work.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'library',
    'library',
    false,
    8388608,
    array['image/png','image/jpeg','image/webp','image/gif','image/avif','video/mp4']
  )
  on conflict (id) do nothing;

  /* Reads happen through the caller's own session, because that is what signs a
     URL, so staff need select on the objects. Writes go through server actions
     with the service role after requirePermission('library','full'), the same
     doctrine as every other write in this app, so no insert policy is granted
     here: nothing in a browser puts a file in this bucket directly. */
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'staff_read_library_objects'
  ) then
    /* Schema qualified. A policy on storage.objects is evaluated with the
       storage schema's search_path, so a bare is_staff() resolves to nothing
       and the policy fails at read time rather than at creation time. */
    create policy staff_read_library_objects on storage.objects
      for select to authenticated
      using (bucket_id = 'library' and public.is_staff());
  end if;
exception
  when insufficient_privilege then
    raise notice 'Not permitted to configure the storage bucket from here. Create a private bucket named "library" in the Supabase dashboard.';
end $$;
