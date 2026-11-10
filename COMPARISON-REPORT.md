# Orbit: the old version, what we changed, and what comes next

**Old version:** https://github.com/N-niko/Orbit-web-n (live at https://orbit-web-amber.vercel.app/)
**Current version:** https://github.com/yampulami/orbit (live at https://www.orbitcampus.org/)

*How this was made (2026-11-10):* I read the old repository's code and history and walked through its live demo, then compared it with this repository (289 commits, 2026-09-20 to 2026-11-09) and the live site. I did not sign in to the old site. Items marked **(check)** are things I could not confirm from the code and the team should confirm.

**Timeline in one line:** the midterm (27 October) was presented with the old version; at the meeting after midterms the team decided to move forward with the current version, so the current repository is the project of record from here on.

---

## 1. The old version (Orbit-web-n)

**What it is.** A Next.js 16 and React 19 app on Supabase, built 19 to 26 October 2026 in 22 commits (mostly Niko, with Sumit's first commit and Yam's last-day redesign). About 7,200 lines of app code, 11 database migrations, 32 test files, and 14 database security test suites that run the real migrations in a throwaway database (PGlite). It is the version the weekly report describes and the one used for the midterm.

**What it does well.**
- **A complete, polished story for Caldwell only.** Warm violet look and friendly copy ("A little closer to your people"), a "Try the demo" mode with a fictional campus (Alex Morgan), and a three-step sign-up with password rules and a photo step.
- **Marketplace.** Sale and Wanted listings, up to four photos, categories, saved listings, private buyer and seller chats, reports, a "no payments" rule, and access limited to confirmed caldwell.edu emails.
- **Campus resource links** (Cougar One Stop, library, registrar, IT, health, safety, map and directions).
- **Roommate workspace.** "My Orbit" with tasks, groceries, expense tracking and an invite code; residence halls follow Caldwell's list.
- **Clubs.** Discover, create, follow, follower-only posts and group chat, and club events that show up in your plans.
- **Social.** Posts with likes, threaded replies and up to four attachments, profile visibility controls, a campus-wide feed with followers-only posts, event end times, owner-only delete.
- **Engineering care.** Server-side validation in API routes, accessible custom select menus, and database tests for who can see what.

**What it does not have.** No direct messages, no friends or "find a time", no notifications, no assistant, no map, no feed ranking, no staff or coordinator verification, one university only, and email confirmation that only reached the team's own addresses.

---

## 2. What we changed (old version to current version)

| | Old version | Current version |
|---|---|---|
| **Stack** | Next.js 16 and React 19 with server API routes | Vite 6, React 19 and React Router 7, talking to Supabase with row-level security, plus 6 server functions (assistant, push sender, staff directory, claims, event import, sign-in by username) |
| **Look** | Cream and violet, rounded, illustrated | Chalk and dark themes, one persimmon accent, flat hairlines, a blinking orb as the character |
| **Audience** | Caldwell only | Any university; every account is walled to its own campus in the database |
| **Navigation** | 8 sections (Home feed, Marketplace, Roommates, Events & plans, Campus hub, Clubs, My profile, Help) | Four labelled places plus You: Home, Chats, Plans, Campus (Events, Clubs, Map), Roommates; the rest under More |
| **Sign-in** | Email and password, log in on the landing | Email *or username*, branded confirmation email (orbitcampus.org through Resend), a click-to-confirm page, clear expired-link page, resend wait, private account card with change password |
| **Feed** | Posts with reactions and replies, hero and stats | A ranked "For you", reposts that arrive for 3 hours, a Repost menu with Quote, quote posts, up to 4 photos in a grid, audiences |
| **Talking** | Not built | Direct messages with seen and typing, message requests, group chats with plans, unread dots |
| **Planning** | Events with Going, a calendar | Month calendar, week board, class schedule with .ics import, and **Find a time**: ranked suggestions, opt-in busy-time sharing, club meeting times as numbers only, Moments |
| **Campus** | Static resource links, simple clubs | Events with official and club badges, coordinator approval, co-hosts, check-in, reporting, event import from school pages, a real map with student-added places that others vote on |
| **Clubs** | Follow model, no roles | Roles and hierarchy, ownership transfer, anti-fake-office guard, applications approved by coordinators |
| **Trust and safety** | Campus email domain check | Staff and coordinator verification from a school's own directory, blocking, reporting, message requests, a 3-message limit to strangers |
| **Helpers** | None | "Ask Orbit" assistant (can act, with a confirm step), global search, keyboard shortcuts |
| **Tests** | 32 test files, 14 database suites | 516 tests in 63 files (all passing); the database suites have not been ported yet |
| **How the team works** | One person pushing | Pull requests with automatic checks, protected `main`, owner approval for teammates, an owner bypass, a script that builds a safe dev database |

**Terms of use and Privacy policy** (the update that was planned after midterms): rewritten on 2026-11-10 to match the current app. They now cover the email sender (Resend, not Gmail), photos and private storage, reposts and quotes, message requests, free-time sharing, club events and coordinators, staff verification, the Ask Orbit assistant and what it sends, what stays only on a device, the services Orbit uses (Supabase, Vercel, Resend, Groq, OpenStreetMap, jsDelivr, browser push), and your choices. They are still a plain-language draft that a lawyer or faculty advisor should read.

**Recent changes in the last few days:** navigation rebuilt and a design review fixed (labelled bar, Free time into Plans, map into Campus), the ranked feed with reposts and quotes, message requests, wide-screen layouts, the emoji picker, the audience menu and tooltips, and the private account card.

---

## 3. Where the two stand now

**Still only in the old version (candidates to bring over)**
1. **Marketplace** (listings, photos, saved, inquiries, reports). The current app only has a "For sale" tag on posts.
2. **Campus resource links.**
3. **The 14 database security test suites** and the server-side validation habit.
4. **Profile visibility controls**, **residence-hall choice**, **non-image attachments** (PDF, documents), and the **accessible select menus**.
5. **A short first run** (3 steps with a photo) and password rules shown as you type. The current set-up is 9 steps.
6. **The warmer voice.** Current labels are plainer.

**Where the weekly report no longer matches the code**
- It describes the old version (Next.js, used for the midterm). From the post-midterm decision on, the report should name the current stack: **Vite, React and React Router on Supabase**.
- It says *Caldwell only*; the current app is multi-university.
- It says direct messages, notifications and recommendations were dropped; all three now exist (recommendations as plain ranking rules, not machine learning; roommate matching is still not built).
- It says email confirmation is the biggest open issue; that is fixed, though school mail filters can still slow messages to caldwell.edu.
- Test counts and "11 database suites" differ from this repo.

**Honestly unfinished**
- **Rate limits** on signup and login: only the 60-second resend wait exists.
- **Real-account testing** of message requests, friends' reposts and the ranked feed: so far tried in the demo and in tests only.
- **Phone push** needs its keys set; **email notifications** are not built.
- `DESIGN.md` still describes the old cream-and-violet look.
- **Terms and privacy** are rewritten but still need a read-through by the advisor or a lawyer, and the team should confirm three facts in them: the contact email, whether the assistant's AI is switched on and which provider it uses, and that 13 is the age limit **(check)**.

---

## 4. Next moves

**A. This week: get it safe to put in front of students** (first-week-of-November testing is already here)
1. **Two-account test day** (Yam and a teammate): friend request, repost and the "reposted" label, quote, message request and accept, find a time. Fix what breaks.
2. **Email to caldwell.edu:** ask Caldwell IT to allow orbitcampus.org and add the DMARC record, so confirmation emails arrive fast.
3. **Terms and privacy** are done as a draft: have Dr. Veksler or an advisor read them, and confirm the three facts noted in section 3. Still to do: **login and signup attempt limits**.
4. **Fill the live site** with realistic posts, clubs, events and plans, and write the demo around **a student's normal day** (Dr. Veksler's feedback), shown live.

**B. Next two weeks: bring back what the old version had**
5. **Marketplace page**, ported from the old repo's tables and rules (photos, saved, inquiries, reports, caldwell.edu access). *Decision needed:* port it or keep the "For sale" tag.
6. **Campus resource links** under Campus.
7. **Port the database security tests** and run them against our 39 migrations, so "students can only see what they should" is proven again.
8. **Shorten set-up** to three steps with a photo; move interests and alerts to later prompts.

**C. Then: depth that sets Orbit apart**
9. **Roommate compatibility** as plain rules like the feed (lifestyle, schedule, habits), and **event recommendations** from interests.
10. **Tune the feed** with real use: a "show less like this" control, hobbies from the profile, and notifications for reposts and quotes.
11. **Email notifications** and phone push.

**D. Process and decisions**
12. **One codebase, decided.** The team chose the current version after midterms. Archive the old repository (mark it read-only with a note pointing here), and make the weekly report and the README name the current stack.
13. **Teammates start using pull requests** (first teammate pull request also proves the automatic checks), and make the "Typecheck, tests and build" check required.
14. **Quality pass:** test on real phones, check loading speed on the live site, re-run the design review (last score 28 out of 40), and regenerate `DESIGN.md`.
15. **Decide the mascot:** the Rive sketch in `mascot/` is not in the app; either commission real art or drop it.
