-- Existing file records reference Emergent objects; new uploads can use Supabase.
-- Keeping the provider on each row lets deployments migrate credentials without
-- breaking access to images that have not yet been copied.
alter table public.files
    add column if not exists storage_provider text not null default 'emergent';

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'files_storage_provider_check'
          and conrelid = 'public.files'::regclass
    ) then
        alter table public.files
            add constraint files_storage_provider_check
            check (storage_provider in ('emergent', 'supabase'));
    end if;
end $$;
