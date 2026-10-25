# Accounts: usernames, signing in with a username, and forgot password

The app side is built. Four things need you, because they are project settings, a deploy, or a secret. Until they are done the app still works: signing in with an email is unchanged, and the new parts say plainly that they are not switched on yet.

## 1. Apply the database change

Open the SQL editor in the Supabase dashboard and run `supabase/migrations/20261023120000_unique_usernames_sign_in.sql`. It:
- makes usernames unique across all of Orbit (before, only per campus), which signing in by username needs;
- renames one leftover test account's username (`qa_dana` on the "QA Other" campus) so that can be built; it deletes nothing;
- refuses names like `admin` and `orbit`;
- adds `username_available(...)`, a yes-or-no check the sign up form uses to say "taken" as you type.

If it fails with a duplicate-key error, two students already share a username. Run `select username, count(*) from student_profiles where username is not null group by 1 having count(*) > 1;`, send me the rows, and I will fix it.

## 2. Deploy the sign in function (this is what makes "sign in with a username" work)

In a terminal, from the project folder:

```bash
npx supabase functions deploy sign-in --project-ref ywhoyolsbgjqgkfziyin
```

It looks the email up on the server, so the app can never ask "what is the email for this username?". It gives the same vague error for an unknown name and a wrong password.

## 3. Make the reset email contain a code

Supabase sends a link by default. To send a code instead, change the template:

1. Supabase dashboard, then **Authentication**, then **Emails** (older dashboards: **Email Templates**), then **Reset Password**.
2. Set the subject to `Your Orbit code`.
3. Set the body to:

```html
<h2>Reset your Orbit password</h2>
<p>Your code is:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:700">{{ .Token }}</p>
<p>It works for one hour. If you did not ask for this, you can ignore this email.</p>
```

The code length is 6 digits by default and is set under Authentication, then Sign In / Providers, then Email.

## 4. Send the emails from your own address (strongly recommended)

Supabase's built-in email sender is meant for testing and allows only a handful of emails per hour for the whole project. Sign up confirmations and reset codes share that limit, so a few students signing up at once would not get their emails.

Fix it with custom SMTP: Authentication, then **Emails**, then **SMTP Settings**. You already have `orbit.app.mails@gmail.com`; a Gmail address can send through `smtp.gmail.com` on port 465 using an **app password** (Google account, Security, 2-Step Verification, App passwords). That password is a secret: type it into the Supabase form yourself and never share it. A free Resend or Brevo account with a verified address is a sturdier option if it gets busy.

## How to check it all works

- **Sign up** on the live site: the username box says "available" or "taken" as you type, and you cannot sign up without one.
- **Sign in** with your email, then sign out and sign in with your username. A wrong password says "That username, email or password is not right." either way.
- **Forgot password**: choose it on the sign in page, type your email, and the email should arrive within a minute with a 6-digit code. Type the code and a new password; you are signed in.

## Things worth knowing

- Forgot password takes an **email**, not a username. It says "if that address has an account, we have emailed it" whether or not it does, so nobody can use it to find out who is on Orbit.
- Guests have no email or password, so none of this applies to them. A guest picks a username during onboarding.
- Someone who signed up before this has no username until they choose one in Profile. They can still sign in with their email.

## Confirmation links on any device

The "Confirm your email" link must open on a phone as well as the computer that signed up. Two things make that work:

1. In Supabase, **Authentication → URL Configuration**: set **Site URL** to `https://orbit-oncampus.vercel.app` and add `https://orbit-oncampus.vercel.app/**` under **Redirect URLs**. If the Site URL still says `localhost`, the button in the email opens a page that only exists on the developer's computer.
2. The app now sends the live address in the link even when the account is made from `localhost`, and shows a plain message on the sign-in page if a link has expired or was already used.
