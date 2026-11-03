-- Imported events follow the same approval rule as every other event from a club: an official office (or a club a coordinator marked trusted)
-- publishes at once; any other club's imported events wait as "pending" for a coordinator. Before this, an import always published.
-- (Builds on 20261103140000_event_sources.sql.)

create or replace function public.campus_event_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare lbl text; r text; o public.campus_orgs;
begin
  if auth.uid() is null and new.external_key is not null then
    select * into o from public.campus_orgs where id = new.org_id;
    if o.id is null or o.campus_key <> new.campus_key or o.status <> 'active' or o.kind = 'circle' then raise exception 'This organization cannot post events right now.' using errcode = '42501'; end if;
    new.host_label := o.name; new.kind := o.kind;
    new.status := case when o.kind = 'official' or o.trusted then 'published' else 'pending' end;
    new.reviewed_by := null; new.reviewed_at := null; new.review_note := null; new.canceled_at := null;
    return new;
  end if;
  if new.org_id is not null then
    select * into o from public.campus_orgs where id = new.org_id;
    if o.id is null or o.campus_key <> new.campus_key or o.status <> 'active' then raise exception 'This club cannot post events right now.' using errcode = '42501'; end if;
    if o.kind = 'circle' then raise exception 'Student circles cannot post campus events. Apply to start a club to host events.' using errcode = '42501'; end if;
    if not ('events' = any (coalesce(public.org_perms(o.id, new.host_id), '{}'::text[]))) then raise exception 'Your role in this club does not include posting events.' using errcode = '42501'; end if;
    new.host_label := o.name; new.kind := o.kind;
    new.status := case when o.kind = 'official' or o.trusted then 'published' else 'pending' end;
  else
    select label, role into lbl, r from public.campus_hosts where user_id = new.host_id;
    if lbl is null then raise exception 'Only campus hosts can post events.' using errcode = '42501'; end if;
    new.host_label := lbl;
    if r = 'student' then new.kind := 'student'; new.status := 'pending'; else new.kind := 'official'; new.status := 'published'; end if;
  end if;
  new.reviewed_by := null; new.reviewed_at := null; new.review_note := null; new.canceled_at := null;
  if (select count(*) from public.campus_events where host_id = new.host_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'That is a lot of events for one day. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- A batch of imports waiting for approval does not send the coordinators one notification per event; they see them in the waiting list.
create or replace function public.campus_event_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
declare tell_campus boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' and new.starts_at > now() and new.external_key is null then tell_campus := true; end if;
    if new.status = 'pending' and new.external_key is null then
      insert into public.notifications (recipient_id, actor_id, kind, body)
      select h.user_id, new.host_id, 'event', left('Waiting for approval: ' || new.title, 200)
      from public.campus_hosts h where h.campus_key = new.campus_key and h.role in ('coordinator', 'staff') and h.user_id <> new.host_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'pending' and new.status = 'published' then
      tell_campus := new.starts_at > now();
      insert into public.notifications (recipient_id, actor_id, kind, body) values (new.host_id, new.reviewed_by, 'event', left('Approved: ' || new.title, 200));
    elsif old.status = 'pending' and new.status = 'rejected' then
      insert into public.notifications (recipient_id, actor_id, kind, body)
      values (new.host_id, new.reviewed_by, 'event', left('Not approved: ' || new.title || coalesce(' (' || new.review_note || ')', ''), 200));
    end if;
    if old.canceled_at is null and new.canceled_at is not null then
      insert into public.notifications (recipient_id, actor_id, kind, body)
      select r.user_id, new.host_id, 'event', left('Cancelled: ' || new.title, 200)
      from public.campus_event_responses r where r.event_id = new.id and r.user_id <> new.host_id;
    end if;
  end if;
  if tell_campus then
    insert into public.notifications (recipient_id, actor_id, kind, body)
    select m.user_id, new.host_id, 'event', left(case when new.kind = 'official' then 'Official: ' else 'Student event: ' end || new.host_label || ' - ' || new.title, 200)
    from public.campus_memberships m
    where m.campus_key = new.campus_key and m.user_id <> new.host_id and not public.is_blocked(m.user_id, new.host_id);
  end if;
  return null;
end $$;
