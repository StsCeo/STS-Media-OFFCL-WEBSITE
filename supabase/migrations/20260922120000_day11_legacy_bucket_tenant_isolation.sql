-- Day 11: tenant-isolate legacy private buckets.
-- Forward-only. Does not rewrite Day 1–10 migrations.
-- receipts is still used by the expense receipt upload. Object names must be
-- {organization_id}/{expense_id}/{filename}. Access is limited to an AAL2
-- owner or administrator of that organization. No authenticated update or delete.
-- documents has no application upload or download path. Fail it closed.
-- Both buckets stay private. Existing MIME and size settings are unchanged.

update storage.buckets
set public = false
where id in ('receipts', 'documents');

drop policy if exists receipts_owner_select on storage.objects;
drop policy if exists receipts_owner_write on storage.objects;
drop policy if exists receipts_owner_insert on storage.objects;

create policy receipts_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.sts_has_organization_role(
      public.sts_storage_org_id(name),
      array['owner', 'administrator']
    )
  );

create policy receipts_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and name not like '%..%'
    and public.sts_storage_org_id(name) is not null
    and public.sts_has_organization_role(
      public.sts_storage_org_id(name),
      array['owner', 'administrator']
    )
  );

drop policy if exists documents_owner_select on storage.objects;
drop policy if exists documents_owner_write on storage.objects;
drop policy if exists documents_owner_insert on storage.objects;
