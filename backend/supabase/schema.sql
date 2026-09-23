-- ============================================================
-- OneWay Bot — Supabase Schema (Postgres + pgvector + RLS)
-- Features: Dashboard (user + admin), Knowledge, Bookings,
--           Leads, Inbox (chat history), usage quotas.
-- Run this ONCE in the Supabase SQL Editor.
-- ============================================================

create extension if not exists vector;

-- ---------- Organizations (tenants) ----------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references auth.users(id) on delete cascade,
  industry text,
  timezone text default 'UTC',
  -- plan/quota support (used by chat quota logic + admin dashboard)
  plan text default 'free',
  plan_expires_at timestamptz,
  monthly_message_quota int,
  created_at timestamptz default now()
);

-- ---------- Users (profile; auth.users is managed by Supabase Auth) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  email text,
  full_name text,
  role text default 'owner', -- 'owner' | 'admin' (platform admin)
  created_at timestamptz default now()
);

-- ---------- Bot settings ----------
create table if not exists public.settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  notify_email text,
  webhook_url text,
  bot_name text default 'OneWay',
  welcome_message text default 'Hi! How can I help you today?',
  brand_color text default '#6366f1',
  updated_at timestamptz default now()
);

-- ---------- Knowledge Documents ----------
create table if not exists public.documents (
  id bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  source_type text check (source_type in ('crawl','upload','manual')),
  url text,
  status text default 'processing' check (status in ('processing','ready','failed')),
  created_at timestamptz default now()
);

-- ---------- Document Sections (chunks + embeddings) ----------
create table if not exists public.document_sections (
  id bigserial primary key,
  document_id bigint not null references public.documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content text not null,
  embedding vector(384), -- all-MiniLM-L6-v2 = 384 dims
  created_at timestamptz default now()
);

create index if not exists document_sections_embedding_idx
  on public.document_sections using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists document_sections_org_idx
  on public.document_sections(organization_id);

-- ---------- Chat History (Inbox) ----------
create table if not exists public.chat_history (
  id bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id text not null,
  role text not null check (role in ('user','assistant')),
  message text not null,
  channel text default 'web',
  created_at timestamptz default now()
);

create index if not exists chat_history_org_session_idx
  on public.chat_history(organization_id, session_id, created_at);

-- ---------- Bookings ----------
create table if not exists public.bookings (
  id bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_name text not null,
  contact_info text,
  booking_time timestamptz not null,
  party_size int default 1,
  details text,
  reference text unique,
  status text default 'confirmed' check (status in ('confirmed','cancelled','completed')),
  created_at timestamptz default now()
);

-- ---------- Leads ----------
create table if not exists public.leads (
  id bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_name text,
  contact_info text,
  source text default 'chat',
  notes text,
  created_at timestamptz default now()
);

-- ---------- Usage Tracking (quotas) ----------
create table if not exists public.usage_events (
  id bigserial primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (event_type in ('message','embedding','booking','lead','crawl')),
  tokens int default 0,
  created_at timestamptz default now()
);

create index if not exists usage_events_org_time_idx
  on public.usage_events(organization_id, event_type, created_at);

-- ============================================================
-- Helper: get org of current user
-- ============================================================
create or replace function public.current_user_org_id()
returns uuid as $$
  select organization_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- ============================================================
-- RLS Policies — tenant isolation on every table
-- ============================================================
alter table public.organizations      enable row level security;
alter table public.profiles           enable row level security;
alter table public.settings           enable row level security;
alter table public.documents          enable row level security;
alter table public.document_sections  enable row level security;
alter table public.chat_history       enable row level security;
alter table public.bookings           enable row level security;
alter table public.leads              enable row level security;
alter table public.usage_events       enable row level security;

-- Organizations: owner sees own org
drop policy if exists "org_select_own" on public.organizations;
create policy "org_select_own" on public.organizations
  for select using (id = public.current_user_org_id());

drop policy if exists "org_insert_own" on public.organizations;
create policy "org_insert_own" on public.organizations
  for insert with check (owner_user_id = auth.uid());

drop policy if exists "org_update_own" on public.organizations;
create policy "org_update_own" on public.organizations
  for update using (owner_user_id = auth.uid());

-- Profiles: user sees own profile
drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profile_insert_own" on public.profiles;
create policy "profile_insert_own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_update_own" on public.profiles
  for update using (id = auth.uid());

-- Generic per-org policies for tenant tables
do $$
declare t text;
begin
  foreach t in array array['settings','documents','document_sections','chat_history','bookings','leads','usage_events']
  loop
    execute format('drop policy if exists "%s_org_all" on public.%I;', t, t);
    execute format(
      'create policy "%s_org_all" on public.%I for all using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id());',
      t, t);
  end loop;
end $$;

-- ============================================================
-- Trigger: auto-create profile + organization + settings on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare new_org uuid;
begin
  insert into public.organizations (name, owner_user_id)
  values (coalesce(new.raw_user_meta_data->>'business_name', split_part(new.email,'@',1)), new.id)
  returning id into new_org;

  insert into public.profiles (id, organization_id, email, full_name)
  values (new.id, new_org, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.settings (organization_id)
  values (new_org);

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RPC: similarity search scoped to tenant (used by backend service role)
-- ============================================================
create or replace function public.match_document_sections(
  query_embedding vector(384),
  match_count int default 5,
  org_id uuid default null
)
returns table (id bigint, document_id bigint, content text, similarity float)
language sql stable as $$
  select ds.id, ds.document_id, ds.content,
         1 - (ds.embedding <=> query_embedding) as similarity
  from public.document_sections ds
  where ds.organization_id = org_id
  order by ds.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- Performance indexes for dashboard counters
-- /api/org/me counts leads, documents and bookings per organization on
-- every dashboard load; without these the counts degrade to sequential
-- scans as the tables grow. Safe to re-run (IF NOT EXISTS).
-- ============================================================
create index if not exists leads_org_idx
  on public.leads(organization_id);

create index if not exists documents_org_idx
  on public.documents(organization_id);

create index if not exists bookings_org_idx
  on public.bookings(organization_id);


-- ============================================================
-- Vector search: HNSW (supersedes the ivfflat index above)
-- HNSW gives better recall and consistent latency at every
-- table size; ivfflat degrades on small datasets (lists=100).
-- Requires pgvector >= 0.5 (standard on Supabase). Re-runnable.
-- ============================================================
drop index if exists document_sections_embedding_idx;
create index if not exists document_sections_embedding_hnsw
  on public.document_sections using hnsw (embedding vector_cosine_ops);
drop index if exists document_sections_embedding_idx;

-- ============================================================
-- Answer-cache busting: chat.js keys its in-memory answer cache on
-- organizations.version; bump it whenever an org's knowledge changes
-- (document inserted/updated/deleted) so fresh crawls/uploads reflect
-- immediately instead of waiting for the 10-minute TTL.
-- Run ONCE in the Supabase SQL Editor (additive, safe to re-run).
-- ============================================================
alter table public.organizations add column if not exists version int not null default 0;

create or replace function public.bump_org_version() returns trigger
language plpgsql as $$
begin
  update public.organizations
     set version = version + 1
   where id = coalesce(new.organization_id, old.organization_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists documents_bump_version on public.documents;
create trigger documents_bump_version
  after insert or update or delete on public.documents
  for each row execute function public.bump_org_version();
