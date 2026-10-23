import { Link } from "react-router-dom";

const CONTACT = "orbit.app.mails@gmail.com";
const UPDATED = "October 2026";

/** The Terms and the Privacy Policy, written in plain words to match what Orbit actually does. This is a draft for a student project:
 *  it should be read over by someone qualified (a faculty advisor or a lawyer) before Orbit is opened to the public. */
export default function Legal({ kind }: { kind: "terms" | "privacy" }) {
  return (
    <main className="legal">
      <div className="legal-card">
        <Link to="/" className="logo"><i />Orbit</Link>
        <nav className="legal-tabs" aria-label="Legal pages">
          <Link to="/terms" aria-current={kind === "terms" ? "page" : undefined}>Terms</Link>
          <Link to="/privacy" aria-current={kind === "privacy" ? "page" : undefined}>Privacy</Link>
        </nav>
        {kind === "terms" ? <Terms /> : <Privacy />}
        <p className="muted legal-foot">Last updated {UPDATED}. Questions or problems: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. <Link to="/">Back to Orbit</Link></p>
      </div>
    </main>
  );
}

function Terms() {
  return (
    <article>
      <h1>Terms of use</h1>
      <p className="legal-draft">This is a plain-language draft for a student project and has not been reviewed by a lawyer.</p>

      <h2>What Orbit is</h2>
      <p>Orbit is an app for students at a university: a feed, groups and chat, plans, a campus map, and tools for roommates. It was built as a senior capstone project. It is not run by, or endorsed by, any university.</p>

      <h2>Who can use it</h2>
      <p>Orbit is for students. You must be at least 13 years old. You choose your campus when you join. Signing up does not prove you go there, so do not assume everyone you meet on Orbit is who they say they are.</p>

      <h2>How to behave</h2>
      <p>Be decent to people. You may not use Orbit to:</p>
      <ul>
        <li>harass, bully, threaten or target anyone, or encourage others to;</li>
        <li>post anything illegal, sexual content involving anyone under 18, or content that promotes harming yourself or others;</li>
        <li>pretend to be someone else, or use a name that could be mistaken for Orbit itself;</li>
        <li>share other people's private information, such as their address, phone number or photos, without their permission;</li>
        <li>send spam, advertise things unrelated to campus life, or scam people;</li>
        <li>try to break, overload or get around the safety of Orbit, or to look at other people's accounts.</li>
      </ul>

      <h2>What you post</h2>
      <p>What you post stays yours. By posting it, you let Orbit show it to the people you chose (your campus, a group, or one person). If you delete something or delete your account, it is removed from Orbit, though people may have already seen it.</p>

      <h2>Reports, blocking and removal</h2>
      <p>You can report a person, post or comment, and block anyone. A blocked person cannot see what you post or message you. Reports are read by whoever looks after Orbit. We may remove content, or suspend or remove accounts, that break these rules or that put people at risk. Orbit is run by students, so a response may not be immediate. If someone is in danger, contact campus security or emergency services, not Orbit.</p>

      <h2>Meeting people and money</h2>
      <p>Plans, hangouts and chats are between students, and you are responsible for your own safety: meet in public places and tell a friend. The roommate tools only keep a record. Orbit never moves money, and a payment marked "paid" is just a note that you paid each other outside the app.</p>

      <h2>No guarantees</h2>
      <p>Orbit is provided as it is. It may have mistakes, be unavailable at times, or change. To the extent the law allows, the people who made Orbit are not responsible for losses that come from using it or from what other users do.</p>

      <h2>Ending your account</h2>
      <p>You can delete your account at any time in Profile. Guest accounts are deleted when you sign out.</p>

      <h2>Changes</h2>
      <p>If these terms change in a way that matters, we will say so in the app. Using Orbit after that means you accept the new terms.</p>
    </article>
  );
}

function Privacy() {
  return (
    <article>
      <h1>Privacy policy</h1>
      <p className="legal-draft">This is a plain-language draft for a student project and has not been reviewed by a lawyer.</p>

      <h2>What we keep</h2>
      <ul>
        <li><strong>Your account:</strong> your email address and a password (the password is stored scrambled, so we cannot read it). Guest accounts have neither.</li>
        <li><strong>Your profile:</strong> your name, username, campus, how long you have been on campus, where you live (kept private, never shown to others), your interests and your settings.</li>
        <li><strong>What you make:</strong> posts, comments and likes, group chats, direct messages, plans and your answers to them, friend requests, map places you add and your votes on them, chores, groceries, expenses and payments in a household, notes, reminders, pins, and reports you send.</li>
        <li><strong>If you turn on device alerts:</strong> an address your browser gives us so we can send you alerts, which is removed when you turn alerts off.</li>
      </ul>

      <h2>Who can see what</h2>
      <ul>
        <li>People on your campus can see your name, username, year and interests, and your posts and comments.</li>
        <li>A group's chat and plans are visible only to its members. A direct message is visible only to the two of you. A household is visible only to its members.</li>
        <li>A plan marked open to the campus is visible to everyone on your campus.</li>
        <li>Your email address is never shown to other students.</li>
        <li>Someone you have blocked cannot see your profile, posts, comments, messages or plans.</li>
      </ul>

      <h2>What we do not do</h2>
      <p>We do not sell your information, show ads, or share it with advertisers.</p>

      <h2>Who helps us run Orbit</h2>
      <ul>
        <li><strong>Supabase</strong> stores the database and handles signing in (servers in the United States).</li>
        <li><strong>Vercel</strong> hosts the website.</li>
        <li><strong>Google (Gmail)</strong> sends the emails we send you, like confirming your address or a password code.</li>
        <li><strong>OpenStreetMap</strong> provides the campus map. Your browser asks it for map pictures and for the names of buildings at your campus.</li>
      </ul>
      <p>These services may keep their own technical logs, such as the time of a request and your network address.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Change your name and username in Profile at any time.</li>
        <li>Delete your account in Profile. That removes your profile and what you made. A group you started stays with the friends still in it.</li>
        <li>Guest accounts are deleted when you sign out.</li>
        <li>Block or report anyone from their post, comment, message or profile.</li>
      </ul>

      <h2>Age</h2>
      <p>Orbit is not for children under 13. If you think a younger child has an account, tell us and we will remove it.</p>

      <h2>Changes</h2>
      <p>If this policy changes in a way that matters, we will say so in the app.</p>
    </article>
  );
}
