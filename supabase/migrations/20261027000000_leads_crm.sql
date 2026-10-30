-- Customer lead tracking for the agent CRM.
-- Safe to apply after the original schema, and safe to rerun.
create table if not exists public.leads (
    id            text primary key default gen_random_uuid()::text,
    agent_id      text not null references public.users(id) on delete cascade,
    property_id   text references public.properties(id) on delete set null,
    customer_name text not null,
    phone         text not null,
    email         text,
    status        text not null default 'new'
                  check (status in ('new', 'contacted', 'visit_scheduled', 'negotiating', 'won', 'lost')),
    source        text not null default 'manual'
                  check (source in ('manual', 'phone', 'whatsapp', 'website', 'referral')),
    notes         text,
    follow_up_at  timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists idx_leads_agent_updated on public.leads(agent_id, updated_at desc);
create index if not exists idx_leads_agent_status on public.leads(agent_id, status);
create index if not exists idx_leads_follow_up on public.leads(agent_id, follow_up_at)
    where follow_up_at is not null;
create index if not exists idx_leads_property on public.leads(property_id);

alter table public.leads enable row level security;
