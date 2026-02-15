-- Create the Storage bucket used by Admin uploads.
-- This is safe to run multiple times.

insert into storage.buckets (id, name, public)
values ('knowledge-base', 'knowledge-base', false)
on conflict (id) do nothing;

