-- Accepting an introduction opens a normal conversation between the two. Without this they are strangers to the message rules, so the first
-- message would arrive as a "message request" with a 3 message limit, even though the graduate just said yes.
create or replace function public.answer_alumni_intro(req uuid, accept boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare r public.alumni_requests; lo uuid; hi uuid;
begin
  select * into r from public.alumni_requests where id = req and to_user = auth.uid() and status = 'pending';
  if not found then raise exception 'That request was not found.' using errcode = 'P0002'; end if;
  update public.alumni_requests set status = case when accept then 'accepted' else 'declined' end, decided_at = now() where id = req;
  -- only a yes is announced and opens a chat; a no is left quiet
  if accept then
    if public.is_blocked(r.from_user, r.to_user) then return; end if;
    lo := least(r.from_user, r.to_user); hi := greatest(r.from_user, r.to_user);
    insert into public.direct_conversations (campus_key, user_low, user_high) values (public.my_campus_key(), lo, hi) on conflict (user_low, user_high) do nothing;
    perform set_config('orbit.dm_internal', 'on', true);
    update public.direct_conversations set status = 'accepted' where user_low = lo and user_high = hi and status <> 'accepted';
    insert into public.notifications (recipient_id, actor_id, kind, body) values (r.from_user, auth.uid(), 'intro', 'accepted your request. You can message them now.');
  end if;
end $$;
revoke all on function public.answer_alumni_intro(uuid, boolean) from public, anon;
grant execute on function public.answer_alumni_intro(uuid, boolean) to authenticated;
