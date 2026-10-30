-- Public property links use high-entropy tokens and expose only a whitelisted view.
-- Revoke a link by clearing public_share_token; owner contact remains private by default.
alter table public.properties
    add column if not exists public_share_token text,
    add column if not exists public_contact_enabled boolean not null default false;

create unique index if not exists idx_properties_public_share_token
    on public.properties(public_share_token)
    where public_share_token is not null;
