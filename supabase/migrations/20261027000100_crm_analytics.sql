-- Add the exact close date used by the performance dashboard.
-- Separate from the original CRM migration so databases that already applied it can upgrade safely.
alter table public.leads add column if not exists closed_at timestamptz;
update public.leads
set closed_at = updated_at
where status in ('won', 'lost') and closed_at is null;
create index if not exists idx_leads_closed_at on public.leads(closed_at)
    where closed_at is not null;
