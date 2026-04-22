alter table public.shows
  add column if not exists dos_contact_email text default null;
