-- =====================================================================
-- عقاراتي (Aqarati) - المخطط الأولي لقاعدة بيانات Supabase
-- يطابق backend/models.py تماماً. آمن لإعادة التشغيل (IF NOT EXISTS).
-- التشغيل:  supabase db push   أو الصق الملف في Dashboard > SQL Editor
-- =====================================================================

create extension if not exists "pgcrypto";   -- لـ gen_random_uuid()

-- ---------- offices ----------
create table if not exists public.offices (
    id           uuid primary key default gen_random_uuid(),
    office_name  text not null,
    phone_number text
);

-- ---------- users ----------
create table if not exists public.users (
    id            text primary key default gen_random_uuid()::text,
    office_id     uuid references public.offices(id) on delete set null,
    email         text unique,
    phone         text unique,
    name          text not null,
    role          text not null default 'agent',
    password_hash text not null,
    created_at    timestamptz not null default now()
);

-- ---------- properties ----------
create table if not exists public.properties (
    id          text primary key default gen_random_uuid()::text,
    total_area  double precision not null,
    price       double precision not null,
    front_width double precision not null,
    length      double precision not null,
    bedrooms    integer not null,
    bathrooms   integer not null,
    owner_name  text default '',
    owner_phone text not null,
    images      jsonb not null default '[]'::jsonb,
    status      text not null default 'available',
    agent_id    text not null,
    agent_name  text not null,
    created_at  timestamptz not null default now(),
    governorate text,
    district    text
);

-- أضف حقول الموقع أيضاً عند ترقية قاعدة قديمة أنشئت قبل هذه النسخة.
alter table public.properties add column if not exists governorate text;
alter table public.properties add column if not exists district text;

-- ---------- subscriptions ----------
-- plan_type: trial | monthly | quarterly | yearly
create table if not exists public.subscriptions (
    id          text primary key default gen_random_uuid()::text,
    user_id     text not null,
    user_name   text not null,
    office_name text,
    plan_type   text not null default 'trial',
    amount      integer not null default 0,
    currency    text not null default 'IQD',
    start_date  timestamptz not null,
    end_date    timestamptz not null,
    status      text not null default 'active',
    created_at  timestamptz not null default now(),
    constraint subscriptions_plan_type_chk
        check (plan_type in ('trial', 'monthly', 'quarterly', 'yearly'))
);

-- ---------- files ----------
create table if not exists public.files (
    id                text primary key default gen_random_uuid()::text,
    storage_path      text not null,
    original_filename text,
    content_type      text,
    size              integer,
    user_id           text not null,
    is_deleted        boolean not null default false,
    created_at        timestamptz not null default now()
);

-- إبطال دائم لرموز التحديث، مشترك بين عمال الخادم ويبقى بعد إعادة التشغيل.
create table if not exists public.revoked_refresh_tokens (
    token_hash varchar(64) primary key,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);

-- ---------- leads (متابعة استفسارات العملاء) ----------
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
    closed_at     timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- ---------- indexes (مطابقة لاستعلامات الخادم) ----------
create index if not exists idx_users_office_id          on public.users(office_id);
create index if not exists idx_properties_agent_id      on public.properties(agent_id);
create index if not exists idx_properties_created_at    on public.properties(created_at desc);
create index if not exists idx_properties_status        on public.properties(status);
create index if not exists idx_properties_governorate   on public.properties(lower(governorate));
create index if not exists idx_properties_district      on public.properties(lower(district));
create index if not exists idx_subscriptions_user_id    on public.subscriptions(user_id);
create index if not exists idx_subscriptions_active     on public.subscriptions(user_id, status, end_date desc);
create index if not exists idx_files_storage_path       on public.files(storage_path);
create index if not exists idx_revoked_refresh_expires  on public.revoked_refresh_tokens(expires_at);
create index if not exists idx_leads_agent_updated       on public.leads(agent_id, updated_at desc);
create index if not exists idx_leads_agent_status        on public.leads(agent_id, status);
create index if not exists idx_leads_follow_up           on public.leads(agent_id, follow_up_at) where follow_up_at is not null;
create index if not exists idx_leads_property            on public.leads(property_id);
create index if not exists idx_leads_closed_at           on public.leads(closed_at) where closed_at is not null;

-- ---------- الأمان (RLS) ----------
-- الخادم (FastAPI) يتصل بدور postgres عبر الـ Pooler فيتجاوز RLS،
-- أما تفعيل RLS بدون سياسات فيمنع واجهة Supabase العامة (anon/authenticated)
-- من قراءة الجداول، ومنها password_hash. لا تحذف هذه الأسطر.
alter table public.offices       enable row level security;
alter table public.users         enable row level security;
alter table public.properties    enable row level security;
alter table public.subscriptions enable row level security;
alter table public.files         enable row level security;
alter table public.revoked_refresh_tokens enable row level security;
alter table public.leads         enable row level security;
