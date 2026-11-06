-- Video yolla (clip farm): dışarıdan gelen video linkleri, onay, metrik takibi ve aylık ödül.

create table if not exists public.clip_campaigns (
  id                    text primary key,
  title                 text not null,
  description           text not null default '',
  -- active | paused | ended
  status                text not null default 'active',
  currency              text not null default 'TRY',
  rate_per_1k_views     numeric(14,4) not null default 0,
  rate_per_like         numeric(14,4) not null default 0,
  rate_per_comment      numeric(14,4) not null default 0,
  rate_per_share        numeric(14,4) not null default 0,
  min_views             integer not null default 0,
  max_per_video         numeric(14,2),
  max_per_creator_month numeric(14,2),
  platforms             text[] not null default array['instagram','tiktok','youtube'],
  rules                 text not null default '',
  starts_on             date,
  ends_on               date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.clip_creators (
  id              text primary key,
  name            text not null,
  contact         text not null default '',
  email           text not null default '',
  payout_method   text not null default '',
  payout_details  text not null default '',
  -- Kişinin beyan ettiği hesaplar: [{ "platform": "instagram", "handle": "x" }]
  accounts        jsonb not null default '[]'::jsonb,
  -- pending | approved | blocked
  status          text not null default 'pending',
  -- Kişinin kendi durum sayfasına giriş anahtarı (gizli).
  access_key      text not null unique,
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.clip_submissions (
  id               text primary key,
  campaign_id      text not null references public.clip_campaigns(id) on delete restrict,
  creator_id       text not null references public.clip_creators(id) on delete cascade,
  url              text not null,
  -- platform:id — aynı video iki kez gönderilemez.
  media_key        text not null unique,
  platform         text not null,
  account_handle   text not null default '',
  -- pending | approved | rejected
  status           text not null default 'pending',
  -- creator: kişi gönderdi | admin: kanaldan biz ekledik
  source           text not null default 'creator',
  reject_reason    text not null default '',
  views            bigint,
  likes            bigint,
  comments         bigint,
  shares           bigint,
  published_at     timestamptz,
  last_checked_at  timestamptz,
  last_check_error text,
  reviewed_at      timestamptz,
  reviewed_by      text,
  created_at       timestamptz not null default now()
);

create index if not exists clip_submissions_creator_idx on public.clip_submissions (creator_id);
create index if not exists clip_submissions_status_idx on public.clip_submissions (status);

create table if not exists public.clip_snapshots (
  submission_id text not null references public.clip_submissions(id) on delete cascade,
  date          date not null,
  views         bigint not null default 0,
  likes         bigint not null default 0,
  comments      bigint not null default 0,
  shares        bigint not null default 0,
  primary key (submission_id, date)
);

create table if not exists public.clip_payouts (
  id          text primary key,
  creator_id  text not null references public.clip_creators(id) on delete cascade,
  month_ym    text not null,
  currency    text not null,
  amount      numeric(14,2) not null,
  -- paid
  status      text not null default 'paid',
  note        text not null default '',
  paid_at     timestamptz not null default now(),
  paid_by     text,
  unique (creator_id, month_ym, currency)
);

comment on table public.clip_submissions is 'Video yolla: dışarıdan gönderilen veya kanaldan seçilen videolar. Servis rolü ile yönetilir.';

alter table public.clip_campaigns   enable row level security;
alter table public.clip_creators    enable row level security;
alter table public.clip_submissions enable row level security;
alter table public.clip_snapshots   enable row level security;
alter table public.clip_payouts     enable row level security;
