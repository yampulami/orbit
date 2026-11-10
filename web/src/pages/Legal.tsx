import { Link } from "react-router-dom";

const CONTACT = "orbit.app.mails@gmail.com";
const UPDATED = "November 2026";

/** The Terms and the Privacy Policy, written in plain words to match what Orbit actually does. This is a draft for a student project:
 *  it should be read over by someone qualified (a faculty advisor or a lawyer) before Orbit is opened to the public. When a feature that touches
 *  people's information changes (a new service, a new kind of data), change the matching lines here in the same commit. */
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
      <p>Orbit is an app for students at a university: a feed, chats and groups, plans and a way to find a time with friends, clubs and campus events, a campus map, and tools for roommates. It was built as a senior capstone project. It is not run by, or endorsed by, any university.</p>

      <h2>Who can use it</h2>
      <p>Orbit is for students. You must be at least 13 years old. You choose your campus when you join. Signing up does not prove you go there, so do not assume everyone you meet on Orbit is who they say they are. Some people (campus staff and event coordinators) are verified against their school's public staff directory and show a badge. A badge means Orbit matched the person to that directory. It does not mean the school endorses Orbit or what that person posts.</p>

      <h2>Your account</h2>
      <p>Keep your password to yourself, and tell us if you think someone else has used your account. Your username is how friends find you and can be used to sign in. It must not copy someone else or pretend to be Orbit, the school, or staff. You are responsible for what happens on your account.</p>

      <h2>How to behave</h2>
      <p>Be decent to people. You may not use Orbit to:</p>
      <ul>
        <li>harass, bully, threaten or target anyone, or encourage others to;</li>
        <li>post anything illegal, sexual content involving anyone under 18, or content that promotes harming yourself or others;</li>
        <li>pretend to be someone else, or use a name that could be mistaken for Orbit itself, the school or its staff;</li>
        <li>share other people's private information, such as their address, phone number or photos, without their permission;</li>
        <li>send spam (including to people who have not accepted your message), advertise things unrelated to campus life, or scam people;</li>
        <li>try to break, overload or get around the safety of Orbit, or to look at other people's accounts.</li>
      </ul>

      <h2>What you post</h2>
      <p>What you post stays yours. By posting it, you let Orbit show it to the people you chose (your campus, a group, or one person). Posts can include up to four photos: only add photos you have the right to share, and do not post private photos of other people.</p>
      <p>Other students can <strong>repost or quote</strong> your posts. A repost or quote shows your name and your post as it is now, and shows up on that person's profile and, for a few hours, in their friends' feeds. If you delete your post, it is removed from Orbit and a quote of it reads "no longer available". If you delete your account, it is removed too, though people may have already seen it.</p>

      <h2>Messages and message requests</h2>
      <p>If you message someone who is not your friend, it arrives as a <strong>message request</strong>. They can accept it, delete it, or block you, and they are not told when you are deleted. Until they answer, you can send at most three messages. A direct message is private to the two of you, but the other person can copy or share it, so only send what you would be comfortable with them keeping.</p>

      <h2>Clubs, events and coordinators</h2>
      <p>Clubs are run by the students who lead them, and are responsible for what they post and the events they run. New clubs and larger events may need approval from a campus coordinator. Events marked official come from verified staff. Some events are imported from a school's or club's public events page, so they can be out of date or wrong: check with the organizer before you rely on one.</p>

      <h2>Free time and plans</h2>
      <p>Sharing when you are free is optional and off until you turn it on. When it is on, the friends you allow can see the hours you are busy, never what for or where. Suggested times are only suggestions: check with people before you count on a time.</p>

      <h2>The Ask Orbit assistant</h2>
      <p>The assistant is an AI. It can be wrong, so do not rely on it for safety, health, money or academic decisions. It can change things for you (like adding a reminder or sending a message) only after you confirm. Do not tell it passwords or other secrets. See the Privacy page for what it sends.</p>

      <h2>Reports, blocking and removal</h2>
      <p>You can report a person, post, comment or event, and block anyone. A blocked person cannot see what you post or message you. Reports are read by whoever looks after Orbit. We may remove content, or suspend or remove accounts, that break these rules or that put people at risk. Orbit is run by students, so a response may not be immediate. If someone is in danger, contact campus security or emergency services, not Orbit.</p>

      <h2>Meeting people and money</h2>
      <p>Plans, hangouts and chats are between students, and you are responsible for your own safety: meet in public places and tell a friend. The roommate tools only keep a record. Orbit never moves money, and a payment marked "paid" is just a note that you paid each other outside the app.</p>

      <h2>No guarantees</h2>
      <p>Orbit is provided as it is. It may have mistakes, be unavailable at times, or change. To the extent the law allows, the people who made Orbit are not responsible for losses that come from using it or from what other users do.</p>

      <h2>Ending your account</h2>
      <p>You can delete your account at any time in Profile, under Settings. Guest accounts are deleted when you sign out.</p>

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

      <h2>What we keep on our servers</h2>
      <ul>
        <li><strong>Your account:</strong> your email address and a password (the password is stored scrambled, so we cannot read it), and the username you chose. Guest accounts have neither.</li>
        <li><strong>Your profile:</strong> your name, username, campus, how long you have been on campus, where you live (kept private, never shown to others), your interests, your short bio, your picture, and your settings.</li>
        <li><strong>What you make:</strong> posts, photos, comments and likes, reposts and quotes, group chats, direct messages and message requests, plans and your answers to them, friend requests, clubs you join or lead, events you answer to, map places you add and your votes on them, chores, groceries, expenses and payments in a household, notes, reminders, pins, and reports you send.</li>
        <li><strong>If you turn on free-time sharing:</strong> the hours you are busy (never the names of your classes or where you are), until you turn it off. If you agree to be counted in a club's meeting times, only a number is ever shown to the club's officers, never who, and only when at least five members agreed.</li>
        <li><strong>If you turn on device alerts:</strong> an address your browser gives us so we can send you alerts, removed when you turn alerts off.</li>
        <li><strong>If you are verified as campus staff or a coordinator:</strong> that you were verified and how (matched to your school's public staff directory, or by a page on the school's own site).</li>
      </ul>

      <h2>What stays only on your device</h2>
      <p>These never reach our servers. They live in your browser, and clearing your browser data removes them:</p>
      <ul>
        <li>your class schedule and any calendar file you import;</li>
        <li>drafts of posts you have not sent;</li>
        <li>what your feed has learned you like (the people and kinds of posts you have liked, replied to, reposted or quoted);</li>
        <li>your Ask Orbit conversations, and your appearance and alert choices.</li>
      </ul>

      <h2>How your feed is ordered</h2>
      <p>Your "For you" feed is ordered on your own device. It uses how new a post is, whether your friends wrote or reposted it, the interests you chose, and what you have liked and replied to before. None of this is sold or shared, and there are no ads. "Everything" is simply newest first.</p>

      <h2>Who can see what</h2>
      <ul>
        <li>People on your campus can see your name, username, year, interests and picture, and your posts and comments.</li>
        <li>Friends can see your reposts for a few hours in their feeds, and on your profile.</li>
        <li>Anyone on your campus can repost or quote your posts. A quote shows your name and your post as it is now.</li>
        <li>A group's chat and plans are visible only to its members. A direct message is visible only to the two of you. A household is visible only to its members.</li>
        <li>A message to someone who is not your friend is shown to them as a request, and is not marked as read until they accept.</li>
        <li>A plan marked open to the campus is visible to everyone on your campus.</li>
        <li>Your email address is never shown to other students.</li>
        <li>Someone you have blocked cannot see your profile, posts, comments, messages or plans.</li>
      </ul>

      <h2>Ask Orbit, the assistant</h2>
      <p>When you use the assistant, your question, the recent conversation, and the Orbit information it needs to answer (for example your schedule, your upcoming events, your groups, or recent posts) are sent through our server to an AI company (Groq, unless we change providers), which writes the reply. We do not store these questions on our servers. The AI company may keep them for a short time under its own rules. Do not tell it passwords or other secrets. If the AI is unavailable, built-in answers use only what is on your device.</p>

      <h2>What we do not do</h2>
      <p>We do not sell your information, show ads, or share it with advertisers.</p>

      <h2>Who helps us run Orbit</h2>
      <ul>
        <li><strong>Supabase</strong> stores the database and your photos, and handles signing in (servers in the United States). Photos are private and are shown to you with temporary links.</li>
        <li><strong>Vercel</strong> hosts the website.</li>
        <li><strong>Resend</strong> sends the emails we send you, like confirming your address or a password code.</li>
        <li><strong>Groq</strong> (an AI company) writes the assistant's replies when the assistant's AI is switched on, as described above.</li>
        <li><strong>OpenStreetMap</strong> provides the campus map. Your browser asks it for map pictures, and Orbit asks it for the names of buildings and places at your campus.</li>
        <li><strong>jsDelivr</strong> provides the emoji pictures. Your browser asks it for them.</li>
        <li><strong>Your browser's push service</strong> (run by Google, Apple or Mozilla, depending on your browser) delivers device alerts if you turn them on.</li>
      </ul>
      <p>Orbit also reads public pages: a school's or club's public events page to import events, and a school's public staff directory to recognize staff. No student information is sent when it does.</p>
      <p>These services may keep their own technical logs, such as the time of a request and your network address, and our database provider may keep routine backups for a short time.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Change your name, username and bio in Profile at any time.</li>
        <li>Turn free-time sharing off, and what we stored of it is deleted. Turn device alerts off, and your alert address is deleted.</li>
        <li>Remove a conversation from your own messages. The other person keeps their copy.</li>
        <li>Delete your account in Profile, under Settings. That removes your profile and what you made, and quotes of your posts read "no longer available". A group you started stays with the friends still in it.</li>
        <li>Guest accounts are deleted when you sign out.</li>
        <li>Block or report anyone from their post, comment, message or profile. Reports are read by whoever looks after Orbit and kept so we can act on them.</li>
      </ul>

      <h2>Age</h2>
      <p>Orbit is not for children under 13. If you think a younger child has an account, tell us and we will remove it.</p>

      <h2>Changes</h2>
      <p>If this policy changes in a way that matters, we will say so in the app.</p>
    </article>
  );
}
