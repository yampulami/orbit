-- A club's public page is the president's to edit: the one-line description, a longer About text, the category and when and where it meets.
-- The application as it was sent (purpose, adviser, size, first event, contact) stays exactly as the coordinator saw it.
-- (Builds on 20261029180000_pod_meetups.sql.)

alter table public.campus_orgs add column if not exists about text not null default '' check (char_length(about) <= 1500);

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
    if (old.status = 'pending' and new.status in ('active', 'rejected')) or (old.status = 'active' and new.status = 'paused') or (old.status = 'paused' and new.status = 'active') then
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
    else
      raise exception 'That status change is not allowed.' using errcode = '42501';
    end if;
  else
    new.review_note := old.review_note; new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end $$;
