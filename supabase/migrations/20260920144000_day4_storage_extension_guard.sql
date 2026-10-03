-- Day 4: reject disallowed extensions on org-documents inserts.
-- Bucket MIME allow-list is not enough when a client labels HTML as text/plain.

drop policy if exists org_documents_insert_scoped on storage.objects;
create policy org_documents_insert_scoped on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'org-documents'
    and public.sts_can_write_documents(public.sts_storage_org_id(name))
    and name not like '%..%'
    and public.sts_storage_org_id(name) is not null
    and lower(split_part(name, '/', 3)) ~ '\.(pdf|png|jpe?g|txt)$'
  );
