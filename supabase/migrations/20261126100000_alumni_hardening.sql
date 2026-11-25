-- Alumni, hardened after a design review: something a coordinator can check, a way to undo a wrong confirmation, a way to take back a claim or a request,
-- no empty or unreachable listings, and a wait before asking again after a no.

alter table public.graduations add column if not exists major text not null default '' check (char_length(major) <= 80);
alter table public.graduations add column if not exists grad_name text not null default '' check (char_length(grad_name) <= 100);

-- 1. A claim now says what the school can check: the major and the name on the degree.
drop function if exists public.claim_graduation(text);
create or replace function public.claim_graduation(proof_in text, major_in text, name_in text)
returns void language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); cur public.graduations; m text := left(btrim(coalesce(major_in, '')), 80); n text := left(btrim(coalesce(name_in, '')), 100);
begin
  select * into cur from public.graduations where user_id = me;
  if not found then raise exception 'Set your graduation month first.' using errcode = '22023'; end if;
  if cur.status in ('claimed', 'verified') then return; end if;
  if make_date(cur.grad_year, cur.grad_month, 1) > current_date then raise exception 'You can confirm once your graduation month arrives.' using errcode = '22023'; end if;
  if char_length(m) < 2 or char_length(n) < 2 then raise exception 'Add your major and the name on your degree, so it can be checked.' using errcode = '22023'; end if;
  update public.graduations set status = 'claimed', proof = left(btrim(coalesce(proof_in, '')), 300), major = m, grad_name = n, note = '', claimed_at = now(), updated_at = now() where user_id = me;
  insert into public.notifications (recipient_id, actor_id, kind, body)
    select h.user_id, me, 'alumni', 'says they graduated. Check it in Campus, Review.' from public.campus_hosts h
    where h.campus_key = cur.campus_key and h.role in ('coordinator', 'staff') and h.user_id <> me;
end $$;
revoke all on function public.claim_graduation(text, text, text) from public, anon;
grant execute on function public.claim_graduation(text, text, text) to authenticated;

create or replace function public.withdraw_graduation()
returns void language sql security definer set search_path = public
as $$ update public.graduations set status = 'expected', claimed_at = null, updated_at = now() where user_id = auth.uid() and status = 'claimed' $$;
revoke all on function public.withdraw_graduation() from public, anon;
grant execute on function public.withdraw_graduation() to authenticated;

-- 2. Saying no needs a reason, so the student knows what to fix.
create or replace function public.review_graduation(target uuid, approve boolean, note_in text)
returns void language plpgsql security definer set search_path = public
as $$
declare g public.graduations; why text := left(btrim(coalesce(note_in, '')), 200);
begin
  if not public.can_review_events() then raise exception 'Only a coordinator can do that.' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'Another coordinator has to check yours.' using errcode = '42501'; end if;
  select * into g from public.graduations where user_id = target and campus_key = public.my_campus_key() and status = 'claimed';
  if not found then raise exception 'That request was not found.' using errcode = 'P0002'; end if;
  if not approve and why = '' then raise exception 'Say why, so they know what to fix.' using errcode = '22023'; end if;
  update public.graduations set status = case when approve then 'verified' else 'declined' end,
    note = case when approve then '' else why end, reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now() where user_id = target;
  insert into public.notifications (recipient_id, actor_id, kind, body) values (target, auth.uid(), 'alumni',
    case when approve then 'confirmed your graduation. You now have the Alumni badge.' else 'could not confirm your graduation yet. See Alumni for the reason.' end);
end $$;

-- 3. A wrong confirmation can be taken away again. The listing is hidden and waiting requests to them are closed.
create or replace function public.revoke_graduation(target uuid, note_in text)
returns void language plpgsql security definer set search_path = public
as $$
declare why text := left(btrim(coalesce(note_in, '')), 200);
begin
  if not public.can_review_events() then raise exception 'Only a coordinator can do that.' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'Another coordinator has to change yours.' using errcode = '42501'; end if;
  if why = '' then raise exception 'Say why, so they know what to fix.' using errcode = '22023'; end if;
  update public.graduations set status = 'declined', note = why, reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
    where user_id = target and campus_key = public.my_campus_key() and status = 'verified';
  if not found then raise exception 'That graduate was not found.' using errcode = 'P0002'; end if;
  update public.alumni_profiles set listed = false where user_id = target;
  update public.alumni_requests set status = 'withdrawn', decided_at = now() where to_user = target and status = 'pending';
  insert into public.notifications (recipient_id, actor_id, kind, body) values (target, auth.uid(), 'alumni', 'took back your graduation confirmation. See Alumni for the reason.');
end $$;
revoke all on function public.revoke_graduation(uuid, text) from public, anon;
grant execute on function public.revoke_graduation(uuid, text) to authenticated;

-- 4. What a coordinator sees: the claim and what can be checked. Only the email's domain is shown, never the address.
create or replace function public.grad_claims()
returns table (user_id uuid, name text, grad_month smallint, grad_year smallint, status text, proof text, major text, grad_name text, email_domain text)
language sql stable security definer set search_path = public
as $$
  select g.user_id, coalesce(p.display_name, 'A student'), g.grad_month, g.grad_year, g.status, g.proof, g.major, g.grad_name, split_part(u.email, '@', 2)
  from public.graduations g
  join auth.users u on u.id = g.user_id
  left join public.student_profiles p on p.user_id = g.user_id
  where public.can_review_events() and g.campus_key = public.my_campus_key() and g.status in ('claimed', 'verified')
  order by g.status, g.claimed_at nulls last
  limit 300
$$;
revoke all on function public.grad_claims() from public, anon;
grant execute on function public.grad_claims() to authenticated;

-- 5. A listing must be reachable after school: a verified personal email, or an account email that is not a school one.
create or replace function public.has_lasting_email(who uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select who = auth.uid() and (
    exists (select 1 from public.private_contacts c where c.user_id = who)
    or exists (select 1 from auth.users u where u.id = who and lower(u.email) !~ '\.(edu|ac)(\.[a-z]{2,3})?$')
  )
$$;
revoke all on function public.has_lasting_email(uuid) from public, anon;
grant execute on function public.has_lasting_email(uuid) to authenticated;

drop policy if exists "alumni write" on public.alumni_profiles;
create policy "alumni write" on public.alumni_profiles for insert to authenticated
with check (user_id = auth.uid() and campus_key = public.my_campus_key() and public.is_verified_alum(auth.uid()) and (not listed or public.has_lasting_email(auth.uid())));
drop policy if exists "alumni edit" on public.alumni_profiles;
create policy "alumni edit" on public.alumni_profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and campus_key = public.my_campus_key() and public.is_verified_alum(auth.uid()) and (not listed or public.has_lasting_email(auth.uid())));

-- ... and it must say something: where they are, and how they can help. The year is always the verified one.
create or replace function public.alumni_profile_year()
returns trigger language plpgsql security definer set search_path = public
as $$
declare y smallint;
begin
  select g.grad_year into y from public.graduations g where g.user_id = new.user_id and g.status = 'verified';
  if y is not null then new.grad_year := y; end if;
  if new.listed then
    if btrim(new.company) = '' and btrim(new.field) = '' then raise exception 'Add a company, or what you studied.' using errcode = '22023'; end if;
    if cardinality(new.open_to) = 0 and btrim(new.about) = '' then raise exception 'Pick how you can help, or write a line for students.' using errcode = '22023'; end if;
  end if;
  return new;
end $$;

-- 6. Requests can be taken back, and a no is respected for 90 days.
alter table public.alumni_requests drop constraint if exists alumni_requests_status_check;
alter table public.alumni_requests add constraint alumni_requests_status_check check (status in ('pending', 'accepted', 'declined', 'withdrawn'));

create or replace function public.withdraw_alumni_intro(req uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.alumni_requests set status = 'withdrawn', decided_at = now() where id = req and from_user = auth.uid() and status = 'pending';
  if not found then raise exception 'That request was not found.' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.withdraw_alumni_intro(uuid) from public, anon;
grant execute on function public.withdraw_alumni_intro(uuid) to authenticated;

create or replace function public.ask_alumni_intro(target uuid, note_text text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); clean text := left(btrim(coalesce(note_text, '')), 300); rid uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if target = me then raise exception 'That is you.' using errcode = '22023'; end if;
  if char_length(clean) < 1 then raise exception 'Write a line about what you are asking for.' using errcode = '22023'; end if;
  if not public.is_verified_alum(target) or not exists (select 1 from public.alumni_profiles a where a.user_id = target and a.listed and a.campus_key = public.my_campus_key()) then
    raise exception 'That person is not taking requests.' using errcode = '22023';
  end if;
  if public.is_blocked(me, target) then raise exception 'That person is not taking requests.' using errcode = '22023'; end if;
  if (select count(*) from public.alumni_requests r where r.from_user = me and r.created_at > now() - interval '1 day') >= 5 then
    raise exception 'You have asked 5 people today. Try again tomorrow.' using errcode = '54000';
  end if;
  if exists (select 1 from public.alumni_requests r where r.from_user = me and r.to_user = target and r.status = 'pending') then
    raise exception 'You already asked this person. Wait for an answer.' using errcode = '23505';
  end if;
  if exists (select 1 from public.alumni_requests r where r.from_user = me and r.to_user = target and r.status = 'declined' and r.decided_at > now() - interval '90 days') then
    raise exception 'You asked them recently. You can ask again later.' using errcode = '54000';
  end if;
  insert into public.alumni_requests (from_user, to_user, note) values (me, target, clean) returning id into rid;
  insert into public.notifications (recipient_id, actor_id, kind, body) values (target, me, 'intro', 'asked you for an introduction');
  return rid;
end $$;
