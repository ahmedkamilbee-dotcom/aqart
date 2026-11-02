-- Add optional contact details used by the property model and API.
-- Safe for databases where either column was already added manually.
alter table public.properties
    add column if not exists whatsapp_number text,
    add column if not exists instagram_username text;
