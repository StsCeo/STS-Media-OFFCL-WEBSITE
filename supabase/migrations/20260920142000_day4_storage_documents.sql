-- Day 4 private organization document bucket and Storage RLS.
-- Antivirus/malware scanning is not implemented.
-- Paths are generated server-side as {organization_id}/{document_id}/{safe-filename}.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-documents',
  'org-documents',
  false,
  8388608,
  array['application/pdf', 'image/png', 'image/jpeg', 'text/plain']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.sts_storage_org_id(p_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  folder text;
begin
  if p_name is null or p_name like '%..%' or p_name like '/%' then
    return null;
  end if;
  folder := (storage.foldername(p_name))[1];
  if folder is null or folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return folder::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.sts_storage_org_id(text) from public, anon;
grant execute on function public.sts_storage_org_id(text) to authenticated;

drop policy if exists org_documents_select_scoped on storage.objects;
create policy org_documents_select_scoped on storage.objects
  for select to authenticated
  using (
    bucket_id = 'org-documents'
    and public.sts_can_read_documents(public.sts_storage_org_id(name))
  );

drop policy if exists org_documents_insert_scoped on storage.objects;
create policy org_documents_insert_scoped on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-documents'
    and public.sts_can_write_documents(public.sts_storage_org_id(name))
    and name not like '%..%'
    and public.sts_storage_org_id(name) is not null
  );

-- No authenticated update/delete policies: objects stay private after metadata archive.

comment on function public.sts_storage_org_id(text) is
  'Parses the organization id from a generated org-documents object path. Returns null for unsafe names.';
