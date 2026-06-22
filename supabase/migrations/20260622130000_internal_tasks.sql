-- Dahili görev takibi (Jira benzeri pano) + yeni personel onboarding planları.
-- Ajans içi: görev oluştur / kişiye ata / durum & öncelik / son tarih (takvim).

create table if not exists public.internal_tasks (
  id                   text primary key,
  title                text not null,
  description          text not null default '',
  -- todo | in_progress | review | done | blocked
  status               text not null default 'todo',
  -- low | normal | high | urgent
  priority             text not null default 'normal',
  -- general | onboarding
  category             text not null default 'general',
  -- atanan kişi (employees.id) — opsiyonel; isim denormalize edilir
  assignee_employee_id text,
  assignee_name        text not null default '',
  -- onboarding görevleri için ilgili yeni personel
  subject_employee_id  text,
  subject_name         text not null default '',
  created_by           text not null default '',
  created_by_name      text not null default '',
  due_date             date,
  done_at              timestamptz,
  order_index          integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.internal_tasks is 'Ajans içi görev panosu (Jira benzeri) + onboarding planları. Servis rolü ile yönetilir.';

create index if not exists internal_tasks_status_idx   on public.internal_tasks (status);
create index if not exists internal_tasks_assignee_idx on public.internal_tasks (assignee_employee_id);
create index if not exists internal_tasks_due_idx      on public.internal_tasks (due_date);

alter table public.internal_tasks enable row level security;
