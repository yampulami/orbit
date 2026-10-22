-- Three more tables that should update live.
-- Reminders and pins now sync between a student's devices (a reminder made on a phone appears on the laptop), and a group's invite code
-- changes show up for the other members. Before this, the app could only pick those up when you came back to the tab.

do $$
declare t text;
begin
  foreach t in array array['reminders', 'user_pins', 'group_invites'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
