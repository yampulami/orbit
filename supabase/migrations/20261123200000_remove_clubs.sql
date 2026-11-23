-- Coordinators and staff can take a club or circle down and bring it back. Nothing is deleted: a removed club is hidden from everyone but reviewers.

-- 1. A new status.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.campus_orgs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.campus_orgs drop constraint %I', c);
  end loop;
end $$;
alter table public.campus_orgs add constraint campus_orgs_status_check check (status in ('pending', 'active', 'paused', 'rejected', 'removed'));

-- 2. Who sees a removed club: reviewers only (its own members and creator no longer do).
drop policy if exists "orgs read" on public.campus_orgs;
create policy "orgs read" on public.campus_orgs for select to authenticated
using (
  campus_key = public.my_campus_key()
  and (status = 'active' or public.can_review_events() or (status <> 'removed' and (created_by = auth.uid() or public.is_org_member(id))))
);

-- 3. The allowed status changes for a reviewer gain: active or paused to removed, and removed back to active.
create or replace function public.campus_org_before_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare reviewer boolean;
begin
  if auth.uid() is null then return new; end if;
  reviewer := public.can_review_events();
  new.campus_key := old.campus_key; new.created_by := old.created_by; new.created_at := old.created_at;
  -- The application stays as it was sent.
  new.purpose := old.purpose; new.advisor_name := old.advisor_name; new.advisor_email := old.advisor_email;
  new.expected_members := old.expected_members; new.first_event := old.first_event; new.contact := old.contact;
  if not reviewer then
    -- The owner may change the public page (description, about, category, meeting); nothing about approval or trust.
    new.name := old.name; new.kind := old.kind; new.status := old.status; new.trusted := old.trusted;
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at; new.review_note := old.review_note;
    return new;
  end if;
  if new.status is distinct from old.status then
    if (old.status = 'pending' and new.status in ('active', 'rejected'))
       or (old.status = 'active' and new.status = 'paused')
       or (old.status = 'paused' and new.status = 'active')
       or (old.status in ('active', 'paused') and new.status = 'removed')
       or (old.status = 'removed' and new.status = 'active') then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    else
      raise exception 'That status change is not allowed.' using errcode = '42501';
    end if;
  else
    new.review_note := old.review_note; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end $$;

-- 4. One call that removes (or restores) a club and its upcoming events together, and tells its members.
create or replace function public.set_org_removed(org uuid, removed boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare o public.campus_orgs;
begin
  if auth.uid() is null or not public.can_review_events() then
    raise exception 'Only a coordinator can do that.' using errcode = '42501';
  end if;
  select * into o from public.campus_orgs where id = org and campus_key = public.my_campus_key();
  if not found then raise exception 'That club was not found.' using errcode = 'P0002'; end if;
  if removed then
    update public.campus_orgs set status = 'removed' where id = org;
    update public.campus_events set status = 'removed' where org_id = org and status = 'published' and starts_at > now();
    insert into public.notifications (recipient_id, actor_id, kind, body)
      select m.user_id, auth.uid(), 'event', left('Removed: ' || o.name || ' was taken down by a coordinator', 200) from public.campus_org_members m where m.org_id = org;
  else
    update public.campus_orgs set status = 'active' where id = org;
    update public.campus_events set status = 'published' where org_id = org and status = 'removed' and starts_at > now();
  end if;
end $$;
revoke all on function public.set_org_removed(uuid, boolean) from public, anon;
grant execute on function public.set_org_removed(uuid, boolean) to authenticated;
