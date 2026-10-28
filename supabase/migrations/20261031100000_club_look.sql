-- A club picks its own look: an accent colour (a hue, 0 to 360) and an icon (one emoji). The president changes them through the same update that edits the About page;
-- the trigger from 20261030100000_club_profile.sql only locks the approval columns, so nothing else is needed.
-- (Builds on 20261030100000_club_profile.sql.)

alter table public.campus_orgs add column if not exists accent smallint check (accent is null or (accent >= 0 and accent <= 360));
alter table public.campus_orgs add column if not exists icon text not null default '' check (char_length(icon) <= 8);
