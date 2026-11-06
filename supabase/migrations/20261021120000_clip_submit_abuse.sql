-- Video yolla: gönderim IP / iletişim birleştirme / spam izleme

alter table public.clip_creators
  add column if not exists contact_norm text,
  add column if not exists last_submit_ip text,
  add column if not exists last_submit_at timestamptz,
  add column if not exists submit_count integer not null default 0;

alter table public.clip_submissions
  add column if not exists submit_ip text;

update public.clip_creators
set contact_norm = lower(regexp_replace(trim(contact), '^@+', ''))
where contact_norm is null and coalesce(contact, '') <> '';

create index if not exists clip_creators_contact_norm_idx
  on public.clip_creators (contact_norm)
  where contact_norm is not null and contact_norm <> '';

create index if not exists clip_submissions_submit_ip_created_idx
  on public.clip_submissions (submit_ip, created_at desc)
  where submit_ip is not null;

create index if not exists clip_submissions_creator_created_idx
  on public.clip_submissions (creator_id, created_at desc);
