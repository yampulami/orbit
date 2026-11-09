-- Message requests. A direct message to someone who is not your friend does not land in their messages: it arrives as a request they can
-- accept or delete. Friends message each other as before. Everything is decided on the server, so the app cannot skip it.
--
--   status   'accepted'  a normal conversation (friends, or the other person accepted / replied)
--            'pending'   a request: the person who started it is `initiator_id`
--            'declined'  the other person deleted the request; it disappears for them and the sender is never told
--
-- While a request is pending or declined the sender can send at most 3 messages, so a stranger cannot flood someone.
-- Conversations that already exist stay accepted. Safe to run twice.

alter table public.direct_conversations
  add column if not exists initiator_id uuid references auth.users(id) on delete set null,
  add column if not exists status text not null default 'accepted';
do $$ begin
  alter table public.direct_conversations add constraint direct_conversations_status_check check (status in ('pending', 'accepted', 'declined'));
exception when duplicate_object then null; end $$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.friendships where user_low = least(a, b) and user_high = greatest(a, b)) $$;
revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- A new conversation: the server decides who started it and whether it is a request. The app cannot choose.
create or replace function public.set_dm_status()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then new.status := 'accepted'; return new; end if; -- an admin tool, not a student
  new.initiator_id := auth.uid();
  new.status := case when public.are_friends(new.user_low, new.user_high) then 'accepted' else 'pending' end;
  return new;
end $$;
drop trigger if exists dm_set_status on public.direct_conversations;
create trigger dm_set_status before insert on public.direct_conversations for each row execute function public.set_dm_status();

-- The status and the starter can only change through the functions below, never by an update from the app.
create or replace function public.protect_dm_status()
returns trigger language plpgsql set search_path = public
as $$
begin
  if auth.uid() is not null
     and (new.status is distinct from old.status or new.initiator_id is distinct from old.initiator_id)
     and coalesce(current_setting('orbit.dm_internal', true), '') <> 'on' then
    raise exception 'A message request can only be answered through its buttons.';
  end if;
  return new;
end $$;
drop trigger if exists dm_protect_status on public.direct_conversations;
create trigger dm_protect_status before update on public.direct_conversations for each row execute function public.protect_dm_status();

-- Accept or delete a request. Only the person who received it can.
create or replace function public.answer_message_request(conv uuid, accept boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare c public.direct_conversations;
begin
  select * into c from public.direct_conversations where id = conv;
  if not found or auth.uid() is null or auth.uid() not in (c.user_low, c.user_high) then raise exception 'That request was not found.'; end if;
  if c.status <> 'pending' then return; end if;
  if c.initiator_id is not distinct from auth.uid() then raise exception 'Only the person who received the request can answer it.'; end if;
  perform set_config('orbit.dm_internal', 'on', true);
  update public.direct_conversations set status = case when accept then 'accepted' else 'declined' end where id = conv;
end $$;
revoke all on function public.answer_message_request(uuid, boolean) from public;
grant execute on function public.answer_message_request(uuid, boolean) to authenticated;

-- Becoming friends turns any waiting request between the two into a normal conversation.
create or replace function public.accept_dms_for_new_friends()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform set_config('orbit.dm_internal', 'on', true);
  update public.direct_conversations set status = 'accepted' where user_low = new.user_low and user_high = new.user_high and status <> 'accepted';
  return new;
end $$;
drop trigger if exists dm_accept_on_friend on public.friendships;
create trigger dm_accept_on_friend after insert on public.friendships for each row execute function public.accept_dms_for_new_friends();

-- Rules on every message: no messages between blocked people, a cap while it is only a request, and a reply from the receiver answers the request.
create or replace function public.guard_direct_message()
returns trigger language plpgsql security definer set search_path = public
as $$
declare c public.direct_conversations; sent int;
begin
  select * into c from public.direct_conversations where id = new.conversation_id;
  if not found then return new; end if; -- the row rules deal with this
  if public.is_blocked(c.user_low, c.user_high) then raise exception 'You cannot message this person.'; end if;
  if c.status in ('pending', 'declined') then
    if new.sender_id is not distinct from c.initiator_id then
      select count(*) into sent from public.direct_messages where conversation_id = c.id and sender_id = new.sender_id;
      if sent >= 3 then raise exception 'You can send more once they reply or accept.'; end if;
    else
      perform set_config('orbit.dm_internal', 'on', true);
      update public.direct_conversations set status = 'accepted' where id = c.id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists direct_message_guard on public.direct_messages;
create trigger direct_message_guard before insert on public.direct_messages for each row execute function public.guard_direct_message();

-- Notifications: a normal message alerts as before. A request alerts once, for its first message. A declined request alerts nobody.
create or replace function public.touch_direct_conversation()
returns trigger language plpgsql security definer set search_path = public
as $$
declare c public.direct_conversations; recipient uuid; n int;
begin
  update public.direct_conversations set updated_at = new.created_at where id = new.conversation_id;
  select * into c from public.direct_conversations where id = new.conversation_id;
  recipient := case when c.user_low = new.sender_id then c.user_high else c.user_low end;
  if c.status = 'accepted' then
    insert into public.notifications(recipient_id, actor_id, kind, conversation_id, body)
    values(recipient, new.sender_id, 'message', new.conversation_id, left(new.body, 120));
  elsif c.status = 'pending' then
    select count(*) into n from public.direct_messages where conversation_id = c.id;
    if n <= 1 then
      insert into public.notifications(recipient_id, actor_id, kind, conversation_id, body)
      values(recipient, new.sender_id, 'message', new.conversation_id, 'sent you a message request');
    end if;
  end if;
  return new;
end $$;
