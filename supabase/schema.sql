create extension if not exists pgcrypto;

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  is_completed boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todos
  add column if not exists media_path text,
  add column if not exists media_type text,
  add column if not exists media_name text,
  add column if not exists media_provider text;

create index if not exists todos_user_id_created_at_idx
  on public.todos (user_id, created_at desc);

create or replace function public.set_todos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_todos_updated_at on public.todos;
create trigger set_todos_updated_at
before update on public.todos
for each row
execute function public.set_todos_updated_at();

alter table public.todos enable row level security;

drop policy if exists "Users can view their own todos" on public.todos;
create policy "Users can view their own todos"
  on public.todos for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own todos" on public.todos;
create policy "Users can create their own todos"
  on public.todos for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own todos" on public.todos;
create policy "Users can update their own todos"
  on public.todos for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own todos" on public.todos;
create policy "Users can delete their own todos"
  on public.todos for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.todos to authenticated;

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Percakapan baru'
    check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_conversations_user_updated_idx
  on public.chat_conversations (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(btrim(content)) between 1 and 12000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at);

create table if not exists public.chatbot_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('persona', 'product')),
  content text not null check (char_length(btrim(content)) between 1 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chatbot_memories_user_kind_created_idx
  on public.chatbot_memories (user_id, kind, created_at);

drop trigger if exists set_chat_conversations_updated_at on public.chat_conversations;
create trigger set_chat_conversations_updated_at
before update on public.chat_conversations
for each row
execute function public.set_todos_updated_at();

drop trigger if exists set_chatbot_memories_updated_at on public.chatbot_memories;
create trigger set_chatbot_memories_updated_at
before update on public.chatbot_memories
for each row
execute function public.set_todos_updated_at();

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chatbot_memories enable row level security;

drop policy if exists "Users can manage their own chat conversations" on public.chat_conversations;
create policy "Users can manage their own chat conversations"
  on public.chat_conversations for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own chat messages" on public.chat_messages;
create policy "Users can read their own chat messages"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.chat_conversations conversation
      where conversation.id = conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can add their own user messages" on public.chat_messages;
create policy "Users can add their own user messages"
  on public.chat_messages for insert
  to authenticated
  with check (
    role = 'user'
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.chat_conversations conversation
      where conversation.id = conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can remove their own user messages" on public.chat_messages;
create policy "Users can remove their own user messages"
  on public.chat_messages for delete
  to authenticated
  using (
    role = 'user'
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.chat_conversations conversation
      where conversation.id = conversation_id
        and conversation.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can read their own chatbot memories" on public.chatbot_memories;
create policy "Users can read their own chatbot memories"
  on public.chatbot_memories for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own chatbot memories" on public.chatbot_memories;
create policy "Users can create their own chatbot memories"
  on public.chatbot_memories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own chatbot memories" on public.chatbot_memories;
create policy "Users can update their own chatbot memories"
  on public.chatbot_memories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own chatbot memories" on public.chatbot_memories;
create policy "Users can delete their own chatbot memories"
  on public.chatbot_memories for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.chat_conversations to authenticated;
grant select, insert, delete on public.chat_messages to authenticated;
grant select, insert, update, delete on public.chatbot_memories to authenticated;

create or replace function public.append_chat_assistant_message(
  p_conversation_id uuid,
  p_content text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  inserted_message public.chat_messages;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(btrim(p_content)) not between 1 and 12000 then
    raise exception 'Invalid assistant message length';
  end if;
  if not exists (
    select 1 from public.chat_conversations
    where id = p_conversation_id and user_id = current_user_id
  ) then
    raise exception 'Conversation not found';
  end if;

  insert into public.chat_messages (conversation_id, user_id, role, content)
  values (p_conversation_id, current_user_id, 'assistant', p_content)
  returning * into inserted_message;

  update public.chat_conversations
  set updated_at = now()
  where id = p_conversation_id and user_id = current_user_id;

  return inserted_message;
end;
$$;

revoke all on function public.append_chat_assistant_message(uuid, text) from public;
grant execute on function public.append_chat_assistant_message(uuid, text) to authenticated;

create table if not exists public.invitation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  host_names text not null check (char_length(btrim(host_names)) between 1 and 160),
  event_date date,
  event_time text check (event_time is null or char_length(event_time) <= 40),
  venue text check (venue is null or char_length(venue) <= 500),
  message text check (message is null or char_length(message) <= 5000),
  template_key text not null default 'elegant'
    check (template_key in ('elegant', 'botanical', 'modern')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invitation_events_user_created_idx
  on public.invitation_events (user_id, created_at desc);

-- Konten undangan yang dapat diisi sendiri oleh pemilik acara.
alter table public.invitation_events
  add column if not exists groom_name text,
  add column if not exists groom_parents text,
  add column if not exists groom_instagram text,
  add column if not exists groom_photo text,
  add column if not exists bride_name text,
  add column if not exists bride_parents text,
  add column if not exists bride_instagram text,
  add column if not exists bride_photo text,
  add column if not exists akad_date date,
  add column if not exists akad_time text,
  add column if not exists akad_venue text,
  add column if not exists quote text,
  add column if not exists quote_source text,
  add column if not exists gift_address text,
  add column if not exists gallery_photos jsonb not null default '[]'::jsonb,
  add column if not exists gift_accounts jsonb not null default '[]'::jsonb;

alter table public.invitation_events
  alter column template_key set default 'elegant';

alter table public.invitation_events
  drop constraint if exists invitation_events_template_key_check;

alter table public.invitation_events
  add constraint invitation_events_template_key_check
  check (template_key in ('elegant', 'botanical', 'modern'));

create table if not exists public.invitation_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.invitation_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  invitation_token uuid not null unique default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  phone text check (phone is null or char_length(phone) <= 40),
  instagram text check (instagram is null or char_length(instagram) <= 100),
  is_sent boolean not null default false,
  sent_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 2000),
  rsvp_status text check (rsvp_status is null or rsvp_status in ('attending', 'not_attending', 'maybe')),
  guest_message text check (guest_message is null or char_length(guest_message) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitation_guests_sent_timestamp_check
    check ((is_sent and sent_at is not null) or (not is_sent and sent_at is null))
);

create index if not exists invitation_guests_event_created_idx
  on public.invitation_guests (event_id, created_at);
create index if not exists invitation_guests_user_event_idx
  on public.invitation_guests (user_id, event_id);

drop trigger if exists set_invitation_events_updated_at on public.invitation_events;
create trigger set_invitation_events_updated_at
before update on public.invitation_events
for each row
execute function public.set_todos_updated_at();

drop trigger if exists set_invitation_guests_updated_at on public.invitation_guests;
create trigger set_invitation_guests_updated_at
before update on public.invitation_guests
for each row
execute function public.set_todos_updated_at();

alter table public.invitation_events enable row level security;
alter table public.invitation_guests enable row level security;

drop policy if exists "Users can manage their own invitation events" on public.invitation_events;
create policy "Users can manage their own invitation events"
  on public.invitation_events for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage guests of their own events" on public.invitation_guests;
create policy "Users can manage guests of their own events"
  on public.invitation_guests for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation_events event
      where event.id = event_id and event.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation_events event
      where event.id = event_id and event.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.invitation_events to authenticated;
grant select, insert, update, delete on public.invitation_guests to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invitation-media',
  'invitation-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Invitation owners can upload their photos" on storage.objects;
create policy "Invitation owners can upload their photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'invitation-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop function if exists public.get_public_invitation(uuid);

create or replace function public.get_public_invitation(p_token uuid)
returns table (
  guest_name text,
  event_title text,
  host_names text,
  event_date date,
  event_time text,
  venue text,
  message text,
  template_key text,
  groom_name text,
  groom_parents text,
  groom_instagram text,
  groom_photo text,
  bride_name text,
  bride_parents text,
  bride_instagram text,
  bride_photo text,
  akad_date date,
  akad_time text,
  akad_venue text,
  quote text,
  quote_source text,
  gift_address text,
  gallery_photos jsonb,
  gift_accounts jsonb,
  rsvp_status text,
  guest_message text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    guest.name,
    event.title,
    event.host_names,
    event.event_date,
    event.event_time,
    event.venue,
    event.message,
    event.template_key,
    event.groom_name,
    event.groom_parents,
    event.groom_instagram,
    event.groom_photo,
    event.bride_name,
    event.bride_parents,
    event.bride_instagram,
    event.bride_photo,
    event.akad_date,
    event.akad_time,
    event.akad_venue,
    event.quote,
    event.quote_source,
    event.gift_address,
    event.gallery_photos,
    event.gift_accounts,
    guest.rsvp_status,
    guest.guest_message
  from public.invitation_guests guest
  join public.invitation_events event on event.id = guest.event_id
  where guest.invitation_token = p_token
  limit 1;
$$;

create or replace function public.submit_public_invitation_rsvp(
  p_token uuid,
  p_status text,
  p_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if p_status not in ('attending', 'not_attending', 'maybe') then
    raise exception 'Invalid RSVP status';
  end if;
  if p_message is not null and char_length(p_message) > 2000 then
    raise exception 'RSVP message is too long';
  end if;

  update public.invitation_guests
  set rsvp_status = p_status,
      guest_message = nullif(btrim(p_message), ''),
      updated_at = now()
  where invitation_token = p_token;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.get_public_invitation(uuid) from public;
revoke all on function public.submit_public_invitation_rsvp(uuid, text, text) from public;
grant execute on function public.get_public_invitation(uuid) to anon, authenticated;
grant execute on function public.submit_public_invitation_rsvp(uuid, text, text) to anon, authenticated;

create table if not exists public.buatqris_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event text not null check (event in (
    'payment.success',
    'payment.expired',
    'payment.failed',
    'withdrawal.pending',
    'withdrawal.approved',
    'withdrawal.rejected'
  )),
  delivery_id text not null check (char_length(btrim(delivery_id)) between 1 and 120),
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (event, delivery_id)
);

alter table public.buatqris_webhook_events enable row level security;
