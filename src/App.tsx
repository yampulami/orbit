import React, { useEffect, useState } from "react";

import {
  Home,
  Users,
  CalendarDays,
  Compass,
  Coffee,
  ShieldCheck,
  DoorOpen,
  BriefcaseBusiness,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Check,
  ShoppingBasket,
  Receipt,
  CheckCheck,
  X,
  Leaf,
  Bell,
  ChevronDown,
  Sparkles,
  Clock,
  MapPin,
  Settings,
  Menu,
  LogOut,
  Repeat2,
  Flag,
  Wrench,
  Moon,
  GraduationCap,
} from "lucide-react";
import {
  seed,
  uid,
  members,
  newSpace,
  nextOwner,
  balances,
  money,
  type State,
  type Space,
} from "./model";
import "./style.css";
const navigation = [
  ["Overview", Home],
  ["Roommates", Users],
  ["Hangouts", Coffee],
  ["Events", CalendarDays],
  ["Clubs", Compass],
  ["Dining", ShoppingBasket],
  ["Safety & alerts", ShieldCheck],
  ["Room booking", DoorOpen],
  ["Campus jobs", BriefcaseBusiness],
] as const;
const events = [
  {
    id: "ev1",
    name: "Sunset on the quad",
    type: "OUTDOORS",
    day: "18",
    month: "SEP",
    time: "Friday · 5:30 PM",
    place: "The main quad",
    art: "sunset",
  },
  {
    id: "ev2",
    name: "A little coffee, a little code",
    type: "MEETUP",
    day: "19",
    month: "SEP",
    time: "Saturday · 10:00 AM",
    place: "Student Union Café",
    art: "coffee",
  },
  {
    id: "ev3",
    name: "Find your people",
    type: "CLUB FAIR",
    day: "22",
    month: "SEP",
    time: "Tuesday · 12:00 PM",
    place: "Student center",
    art: "fair",
  },
];
function readState(): State {
  try {
    const s = JSON.parse(localStorage.getItem("campo-v1") || "null");
    if (
      s?.version === 1 &&
      Array.isArray(s.spaces) &&
      s.spaces.length &&
      s.spaces.some((x: Space) => x.id === s.active)
    )
      return s;
  } catch {}
  return seed();
}
export default function App() {
  const [state, setState] = useState<State>(readState),
    [page, setPage] = useState("Overview"),
    [tab, setTab] = useState("Tasks"),
    [modal, setModal] = useState(""),
    [notice, setNotice] = useState(""),
    [mobile, setMobile] = useState(false),
    [filter, setFilter] = useState("All");
  const space = state.spaces.find((s) => s.id === state.active)!;
  const balance = balances(space.expenses);
  const pending = space.tasks.filter((t) => !t.done);
  const myTasks = pending.filter((t) => t.owner === "You");
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const elements = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex="0"]',
        ) || [],
      );
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal("");
        return;
      }
      if (event.key !== "Tab") return;
      const list = elements(),
        first = list[0],
        last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    if (!dialog?.contains(document.activeElement)) elements()[0]?.focus();
    document.addEventListener("keydown", trap);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [modal]);
  function save(next: State) {
    setState(next);
    try {
      localStorage.setItem("campo-v1", JSON.stringify(next));
    } catch {
      setNotice(
        "Storage is unavailable. Changes will last only for this session.",
      );
    }
  }
  function editSpace(fn: (s: Space) => Space) {
    save({
      ...state,
      spaces: state.spaces.map((s) => (s.id === space.id ? fn(s) : s)),
    });
  }
  function go(p: string) {
    setPage(p);
    setMobile(false);
  }
  function toggleTask(id: string) {
    editSpace((s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      history: [
        `${new Date().toLocaleString()}: ${s.tasks.find((t) => t.id === id)?.done ? "Reopened" : "Completed"} ${s.tasks.find((t) => t.id === id)?.title}`,
        ...s.history,
      ],
    }));
  }
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      title = String(f.get("title") || "").trim();
    if (
      [
        "task",
        "grocery",
        "expense",
        "hangout",
        "space",
        "maintenance",
      ].includes(modal) &&
      !title
    )
      return;
    if (modal === "task")
      editSpace((s) => ({
        ...s,
        tasks: [
          ...s.tasks,
          {
            id: uid(),
            title,
            owner:
              String(f.get("owner")) === "Auto"
                ? nextOwner(s.tasks)
                : String(f.get("owner")),
            points: Number(f.get("points")),
            done: false,
          },
        ],
      }));
    if (modal === "grocery")
      editSpace((s) => ({
        ...s,
        groceries: [
          ...s.groceries,
          {
            id: uid(),
            title,
            category: String(f.get("category")),
            done: false,
          },
        ],
      }));
    if (modal === "expense") {
      const cents = Math.round(Number(f.get("amount")) * 100);
      if (!Number.isSafeInteger(cents) || cents <= 0) return;
      editSpace((s) => ({
        ...s,
        expenses: [
          ...s.expenses,
          { id: uid(), title, cents, payer: String(f.get("payer")) },
        ],
      }));
    }
    if (modal === "hangout")
      save({
        ...state,
        hangouts: [
          ...state.hangouts,
          { id: uid(), title, date: String(f.get("date")), votes: ["You"] },
        ],
      });
    if (modal === "space") {
      const s = newSpace(title);
      save({ ...state, active: s.id, spaces: [...state.spaces, s] });
    }
    if (modal === "maintenance")
      editSpace((s) => ({
        ...s,
        maintenance: [...s.maintenance, { id: uid(), title, done: false }],
      }));
    if (modal === "quiet")
      editSpace((s) => ({
        ...s,
        quiet: `${f.get("start")} – ${f.get("end")}`,
      }));
    if (modal === "profile")
      save({
        ...state,
        name: String(f.get("name")).trim(),
        email: String(f.get("email")).trim(),
      });
    setModal("");
  }
  const taskRows = (limit?: number) => (
    <div className="task-list">
      {(limit ? pending.slice(0, limit) : space.tasks).map((t) => (
        <div className={`task-row ${t.done ? "completed" : ""}`} key={t.id}>
          <button
            className="checkbox"
            aria-label={`${t.done ? "Reopen" : "Complete"} ${t.title}`}
            onClick={() => toggleTask(t.id)}
          >
            {t.done && <Check size={14} />}
          </button>
          <div className="task-label">
            <strong>{t.title}</strong>
            <span>
              {t.points} effort points <span className="dot">·</span>{" "}
              {t.owner === "You" ? "Your turn" : "Shared chore"}
            </span>
          </div>
          <span className={`avatar small ${t.owner.toLowerCase()}`}>
            {t.owner === "You" ? state.name[0] : t.owner[0]}
          </span>
          {!limit && (
            <button
              className="icon-button"
              title="Rotate assignment to next roommate"
              aria-label={`Rotate ${t.title}`}
              onClick={() =>
                editSpace((s) => ({
                  ...s,
                  tasks: s.tasks.map((x) =>
                    x.id === t.id
                      ? {
                          ...x,
                          owner:
                            members[
                              (members.indexOf(x.owner) + 1) % members.length
                            ],
                        }
                      : x,
                  ),
                  history: [
                    `Rotated ${t.title} to ${members[(members.indexOf(t.owner) + 1) % members.length]}`,
                    ...s.history,
                  ],
                }))
              }
            >
              <Repeat2 size={15} />
            </button>
          )}
        </div>
      ))}
      {!space.tasks.length && (
        <p className="empty">A clean slate. Add your first shared task.</p>
      )}
      {limit && !pending.length && (
        <p className="empty">All caught up. Enjoy your breathing room.</p>
      )}
    </div>
  );
  const eventCards = () => (
    <div className="event-grid">
      {events.map((ev) => (
        <article className="event-card" key={ev.id}>
          <div className={`event-art ${ev.art}`}>
            <div className="date-badge">
              <b>{ev.day}</b>
              <span>{ev.month}</span>
            </div>
            <div className="art-orbit" />
            <div className="art-shape" />
            {ev.art === "coffee" ? (
              <Coffee size={70} strokeWidth={1} />
            ) : ev.art === "fair" ? (
              <Users size={70} strokeWidth={1} />
            ) : (
              <span className="sun" />
            )}
            <span className="art-caption">
              {ev.art === "sunset"
                ? "stay a little longer."
                : ev.art === "coffee"
                  ? "good things brewing."
                  : "come as you are."}
            </span>
          </div>
          <div className="event-info">
            <span className="eyebrow">{ev.type}</span>
            <h3>{ev.name}</h3>
            <p>
              <Clock size={13} />
              {ev.time}
            </p>
            <p>
              <MapPin size={13} />
              {ev.place}
            </p>
            <div className="event-bottom">
              <span className="muted">Sample campus event</span>
              <button
                className="text-button"
                onClick={() =>
                  save({
                    ...state,
                    rsvps: state.rsvps.includes(ev.id)
                      ? state.rsvps.filter((x) => x !== ev.id)
                      : [...state.rsvps, ev.id],
                  })
                }
              >
                {state.rsvps.includes(ev.id) ? "Going ✓" : "RSVP +"}{" "}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
  return (
    <div className="app">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brand-icon">
            <Leaf size={24} />
          </span>
          campo<span className="brand-period">.</span>
        </a>
        <p className="brand-tagline">YOUR CAMPUS, TOGETHER</p>
        <div className="campus-switch">
          <span className="campus-icon">
            <GraduationCap size={19} />
          </span>
          <div>
            <strong>Campus community</strong>
            <small>Local demo campus</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-heading">YOUR EVERYDAY</span>
        <nav>
          {navigation.map(([name, Icon], i) => (
            <React.Fragment key={name}>
              {i === 3 && (
                <span className="nav-heading second">AROUND CAMPUS</span>
              )}
              <button
                className={page === name ? "nav-item active" : "nav-item"}
                onClick={() => go(name)}
              >
                <Icon size={19} />
                <span>{name}</span>
                {name === "Roommates" && (
                  <span className="nav-count">{pending.length}</span>
                )}
                {name === "Overview" && <span className="active-dot" />}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="little-note">
            <Sparkles size={20} />
            <p>
              Less juggling.
              <br />
              <strong>More campus life.</strong>
            </p>
            <span>✧</span>
          </div>
          <button className="profile" onClick={() => setModal("profile")}>
            <span className="avatar you">{state.name[0] || "J"}</span>
            <span>
              <strong>{state.name}</strong>
              <small>Student · demo profile</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            My campus <span>/</span> <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-pill">
              <span /> Local demo
            </span>
            <button
              className="icon-button notification"
              aria-label="View announcements"
              onClick={() => go("Safety & alerts")}
            >
              <Bell size={19} />
              <i />
            </button>
            <button
              className="avatar small you"
              aria-label="Edit profile"
              onClick={() => setModal("profile")}
            >
              {state.name[0] || "J"}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "Overview"
                  ? "A LITTLE SPACE FOR EVERYTHING"
                  : "YOUR CAMPUS, CONNECTED"}
              </div>
              <h1>
                {page === "Overview"
                  ? `Hey, ${state.name}. Make yourself at home.`
                  : page}
              </h1>
              <p>
                {page === "Overview"
                  ? "Your people, your plans, and the little things in between."
                  : page === "Roommates"
                    ? "A shared space that feels fair. A little teamwork goes a long way."
                    : page === "Hangouts"
                      ? "Less “we should hang out.” More making it happen."
                      : "Discover what’s happening around you. Sample data for your campus preview."}
              </p>
            </div>
            <button
              className="button secondary date-label"
              onClick={() => go("Events")}
            >
              <CalendarDays size={16} />{" "}
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page === "Overview" && (
            <>
              <section className="hero">
                <div className="hero-text">
                  <span className="hero-tag">
                    <span /> A GOOD DAY STARTS HERE
                  </span>
                  <h2>
                    Campus is better
                    <br />
                    when you do it <em>together.</em>
                  </h2>
                  <p>
                    A calmer room. A fuller calendar. Your kind of people.
                    <br />
                    Let’s make a little room for all of it.
                  </p>
                  <button
                    className="button cream"
                    onClick={() => go("Roommates")}
                  >
                    Step into your space <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <span className="star s1">✧</span>
                  <span className="star s2">✦</span>
                  <div className="floating-label label-top">
                    <CheckCheck size={15} /> Chores? Shared.
                  </div>
                  <div className="house">
                    <div className="roof" />
                    <div className="house-body">
                      <div className="house-window" />
                      <div className="house-door" />
                    </div>
                    <div className="plant">
                      <Leaf />
                      <Leaf />
                      <Leaf />
                    </div>
                  </div>
                  <div className="floating-label label-bottom">
                    <Users size={15} /> Your people. Your place.
                  </div>
                  <div className="ground" />
                </div>
              </section>
              <section className="stats-grid">
                <button
                  className="stat-card"
                  onClick={() => {
                    go("Roommates");
                    setTab("Tasks");
                  }}
                >
                  <span className="stat-icon blue">
                    <CheckCheck size={21} />
                  </span>
                  <div>
                    <span>Your to-dos</span>
                    <strong>
                      {myTasks.length} <small>to get done</small>
                    </strong>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
                <button
                  className="stat-card"
                  onClick={() => {
                    go("Roommates");
                    setTab("Expenses");
                  }}
                >
                  <span className="stat-icon beige">
                    <Receipt size={21} />
                  </span>
                  <div>
                    <span>Roommate balance</span>
                    <strong>
                      {money(Math.abs(balance.You))}{" "}
                      <small>
                        {balance.You >= 0 ? "owed to you" : "you owe"}
                      </small>
                    </strong>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
                <button className="stat-card" onClick={() => go("Hangouts")}>
                  <span className="stat-icon green">
                    <Coffee size={21} />
                  </span>
                  <div>
                    <span>On the horizon</span>
                    <strong>
                      {state.hangouts.length} <small>hangout plans</small>
                    </strong>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
              </section>
              <section className="dashboard-grid">
                <article className="panel roommate-panel">
                  <div className="section-title">
                    <div className="title-icon">
                      <Users size={19} />
                      <h2>Your shared space</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => go("Roommates")}
                    >
                      View space <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="room-banner">
                    <div>
                      <span className="eyebrow">HOME BASE</span>
                      <h3>{space.name}</h3>
                      <p>Keeping life together, together.</p>
                    </div>
                    <div className="avatar-stack">
                      {members.map((m) => (
                        <span
                          key={m}
                          className={`avatar small ${m.toLowerCase()}`}
                        >
                          {m === "You" ? state.name[0] : m[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="subheading">
                    <span>UP NEXT AROUND THE ROOM</span>
                    <button
                      className="icon-button"
                      aria-label="Add a task"
                      onClick={() => setModal("task")}
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                  {taskRows(3)}
                  <div className="panel-foot">
                    <span>
                      <span className="status-dot" />{" "}
                      {space.tasks.filter((t) => t.done).length} chores done.
                      Small wins add up.
                    </span>
                    <Leaf size={15} />
                  </div>
                </article>
                <article className="panel friends-panel">
                  <div className="section-title">
                    <div className="title-icon">
                      <Coffee size={19} />
                      <h2>A little time together</h2>
                    </div>
                    <span className="live-pill">YOUR CIRCLE</span>
                  </div>
                  <div className="free-row">
                    <div className="avatar-stack">
                      <span className="avatar alex">A</span>
                      <span className="avatar sam">S</span>
                      <span className="avatar jordan">J</span>
                    </div>
                    <div>
                      <strong>Your next good memory</strong>
                      <p>Start with a simple plan.</p>
                    </div>
                  </div>
                  <div className="hangout-feature">
                    <span className="eyebrow">LET’S MAKE IT HAPPEN</span>
                    <h3>
                      {state.hangouts[0]?.title ||
                        "Something good with your people"}
                    </h3>
                    <p>
                      <Clock size={14} /> Pick a plan. Find your overlap.
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => go("Hangouts")}
                    >
                      Find a time <ArrowUpRight size={16} />
                    </button>
                    <Coffee
                      className="feature-coffee"
                      size={75}
                      strokeWidth={1}
                    />
                  </div>
                  <button
                    className={`free-toggle ${state.free ? "on" : ""}`}
                    onClick={() => save({ ...state, free: !state.free })}
                  >
                    <span>
                      <span className="status-dot" />
                      {state.free
                        ? "You’re free to hang out"
                        : "Free for a spontaneous plan?"}
                    </span>
                    <span className="switch">
                      <i />
                    </span>
                  </button>
                </article>
              </section>
              <section className="events-section">
                <div className="section-title">
                  <div>
                    <div className="eyebrow">GET OUT THERE</div>
                    <h2>Around the campus</h2>
                  </div>
                  <button className="text-button" onClick={() => go("Events")}>
                    Explore events <ArrowRight size={16} />
                  </button>
                </div>
                {eventCards()}
              </section>
            </>
          )}
          {page === "Roommates" && (
            <>
              <div className="toolbar">
                <label className="space-select">
                  <Users size={18} />
                  <select
                    aria-label="Select roommate space"
                    value={state.active}
                    onChange={(e) => save({ ...state, active: e.target.value })}
                  >
                    {state.spaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button secondary"
                  onClick={() => setModal("space")}
                >
                  <Plus size={16} />
                  New space
                </button>
              </div>
              <div className="tabs">
                {[
                  "Tasks",
                  "Groceries",
                  "Expenses",
                  "Fairness",
                  "House notes",
                ].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "selected" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <section className="panel roomy">
                <div className="section-title">
                  <h2>{tab}</h2>
                  {["Tasks", "Groceries", "Expenses"].includes(tab) && (
                    <button
                      className="button primary"
                      onClick={() =>
                        setModal(
                          tab === "Tasks"
                            ? "task"
                            : tab === "Groceries"
                              ? "grocery"
                              : "expense",
                        )
                      }
                    >
                      <Plus size={16} />
                      Add{" "}
                      {tab === "Tasks"
                        ? "task"
                        : tab === "Groceries"
                          ? "item"
                          : "expense"}
                    </button>
                  )}
                </div>
                {tab === "Tasks" && (
                  <>
                    <p className="muted">
                      Auto-assign gives the next chore to the person with the
                      fewest assigned effort points. Use the rotate button to
                      reassign.
                    </p>
                    {taskRows()}
                  </>
                )}
                {tab === "Groceries" && (
                  <>
                    {space.groceries.map((g) => (
                      <div
                        className={`task-row ${g.done ? "completed" : ""}`}
                        key={g.id}
                      >
                        <button
                          className="checkbox"
                          aria-label={`${g.done ? "Uncheck" : "Check"} ${g.title}`}
                          onClick={() =>
                            editSpace((s) => ({
                              ...s,
                              groceries: s.groceries.map((x) =>
                                x.id === g.id ? { ...x, done: !x.done } : x,
                              ),
                            }))
                          }
                        >
                          {g.done && <Check size={14} />}
                        </button>
                        <div className="task-label">
                          <strong>{g.title}</strong>
                          <span>{g.category}</span>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${g.title}`}
                          onClick={() =>
                            editSpace((s) => ({
                              ...s,
                              groceries: s.groceries.filter(
                                (x) => x.id !== g.id,
                              ),
                            }))
                          }
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    {!space.groceries.length && (
                      <p className="empty">
                        Nothing on the list yet. What does the room need?
                      </p>
                    )}
                  </>
                )}
                {tab === "Expenses" && (
                  <>
                    <div className="balance-banner">
                      <span>
                        {balance.You >= 0 ? "You are owed" : "You owe"}
                        <strong>{money(Math.abs(balance.You))}</strong>
                      </span>
                      <p>
                        All expenses are split equally between the four demo
                        roommates.
                        <br />
                        Amounts are tracked to the cent.
                      </p>
                    </div>
                    {space.expenses.map((e) => (
                      <div className="task-row" key={e.id}>
                        <span className="stat-icon beige">
                          <Receipt size={19} />
                        </span>
                        <div className="task-label">
                          <strong>{e.title}</strong>
                          <span>Paid by {e.payer} · split 4 ways</span>
                        </div>
                        <strong>{money(e.cents)}</strong>
                        <button
                          className="icon-button"
                          aria-label={`Delete expense ${e.title}`}
                          onClick={() => setModal(`delete:${e.id}`)}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
                {tab === "Fairness" && (
                  <>
                    <p className="muted">
                      Chore effort and money balances side by side. Positive
                      balances mean money is owed to that roommate.
                    </p>
                    {members.map((m) => {
                      const assigned = space.tasks
                          .filter((t) => t.owner === m)
                          .reduce((a, t) => a + t.points, 0),
                        done = space.tasks
                          .filter((t) => t.owner === m && t.done)
                          .reduce((a, t) => a + t.points, 0);
                      return (
                        <div className="fair-row" key={m}>
                          <span className={`avatar ${m.toLowerCase()}`}>
                            {m === "You" ? state.name[0] : m[0]}
                          </span>
                          <div>
                            <strong>{m}</strong>
                            <p>
                              {done} completed / {assigned} assigned effort
                              points
                            </p>
                            <div className="progress">
                              <i
                                style={{
                                  width: `${assigned ? (done / assigned) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                          <strong>{money(balance[m])}</strong>
                        </div>
                      );
                    })}
                    <button
                      className="button secondary"
                      onClick={() => setModal("dispute")}
                    >
                      <Flag size={15} />
                      Log a concern
                    </button>
                    <h3 className="history-title">Activity history</h3>
                    {space.history.map((h, i) => (
                      <p className="history" key={i}>
                        {h}
                      </p>
                    ))}
                  </>
                )}
                {tab === "House notes" && (
                  <>
                    <div className="room-banner">
                      <Moon />
                      <div className="task-label">
                        <h3>Quiet hours</h3>
                        <p>{space.quiet}</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setModal("quiet")}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="section-title">
                      <h3>Maintenance log</h3>
                      <button
                        className="button secondary"
                        onClick={() => setModal("maintenance")}
                      >
                        <Plus size={15} />
                        Log issue
                      </button>
                    </div>
                    <p className="muted">
                      Shared household notes only. Submit official work orders
                      through your university.
                    </p>
                    {space.maintenance.map((m) => (
                      <div className="task-row" key={m.id}>
                        <Wrench size={18} />
                        <strong className="task-label">{m.title}</strong>
                        <button
                          className="text-button"
                          onClick={() =>
                            editSpace((s) => ({
                              ...s,
                              maintenance: s.maintenance.map((x) =>
                                x.id === m.id ? { ...x, done: !x.done } : x,
                              ),
                            }))
                          }
                        >
                          {m.done ? "Resolved ✓" : "Mark resolved"}
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </section>
            </>
          )}
          {page === "Hangouts" && (
            <>
              <div className="toolbar">
                <span className="muted">
                  {state.hangouts.length} ideas in the group · votes saved on
                  this device
                </span>
                <button
                  className="button primary"
                  onClick={() => setModal("hangout")}
                >
                  <Plus size={16} />
                  Make a plan
                </button>
              </div>
              <div className="hangout-grid">
                {state.hangouts.map((h) => (
                  <article className="panel roomy" key={h.id}>
                    <span className="stat-icon blue">
                      <Coffee />
                    </span>
                    <h2>{h.title}</h2>
                    <p className="muted">
                      <CalendarDays size={14} />{" "}
                      {new Date(h.date).toLocaleString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p>
                      {h.votes.length} of {members.length} can make it
                    </p>
                    <div className="progress">
                      <i style={{ width: `${(h.votes.length / 4) * 100}%` }} />
                    </div>
                    <p className="muted">
                      {h.votes.join(", ") || "Be the first to vote"}
                    </p>
                    <button
                      className={`button ${h.votes.includes("You") ? "secondary" : "primary"}`}
                      onClick={() =>
                        save({
                          ...state,
                          hangouts: state.hangouts.map((x) =>
                            x.id === h.id
                              ? {
                                  ...x,
                                  votes: x.votes.includes("You")
                                    ? x.votes.filter((v) => v !== "You")
                                    : [...x.votes, "You"],
                                }
                              : x,
                          ),
                        })
                      }
                    >
                      {h.votes.includes("You") ? (
                        <Check size={16} />
                      ) : (
                        <Plus size={16} />
                      )}{" "}
                      {h.votes.includes("You")
                        ? "You’re in · undo"
                        : "I can make it"}
                    </button>
                    {h.votes.length === 4 && (
                      <p className="success">
                        Everyone’s in. You found your overlap!
                      </p>
                    )}
                  </article>
                ))}
              </div>
              <button
                className={`free-toggle standalone ${state.free ? "on" : ""}`}
                onClick={() => save({ ...state, free: !state.free })}
              >
                <span>My “free right now” status</span>
                <span className="switch">
                  <i />
                </span>
              </button>
            </>
          )}
          {page === "Events" && (
            <>
              <div className="info-banner">
                Campus preview · RSVPs are personal demo preferences. No
                organizers are contacted.
              </div>
              {eventCards()}
            </>
          )}
          {page === "Clubs" && (
            <div className="hangout-grid">
              {[
                {
                  name: "Outdoor Club",
                  desc: "Fresh air, new trails, and people to get a little lost with.",
                  icon: Leaf,
                },
                {
                  name: "Code Collective",
                  desc: "Build side projects, learn together, and bring your curiosity.",
                  icon: GraduationCap,
                },
                {
                  name: "The Creative Corner",
                  desc: "A place for your sketches, stories, and next big idea.",
                  icon: Sparkles,
                },
              ].map((c) => (
                <article className="panel roomy" key={c.name}>
                  <span className="stat-icon green">
                    <c.icon />
                  </span>
                  <h2>{c.name}</h2>
                  <p className="muted">{c.desc}</p>
                  <p className="eyebrow">SAMPLE STUDENT ORGANIZATION</p>
                  <button
                    className="button primary"
                    onClick={() =>
                      save({
                        ...state,
                        joined: state.joined.includes(c.name)
                          ? state.joined.filter((x) => x !== c.name)
                          : [...state.joined, c.name],
                      })
                    }
                  >
                    {state.joined.includes(c.name)
                      ? "Joined · leave"
                      : "Join club"}
                    <ArrowUpRight size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
          {page === "Dining" && (
            <>
              <div className="info-banner">
                Sample menus and hours. Live dining feeds and meal plan balances
                are not connected.
              </div>
              <div className="tabs">
                {["All", "Vegetarian"].map((f) => (
                  <button
                    className={filter === f ? "selected" : ""}
                    onClick={() => setFilter(f)}
                    key={f}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="hangout-grid">
                {[
                  {
                    name: "Maple Dining Hall",
                    hours: "7 AM – 9 PM",
                    food: "Harvest grain bowl",
                    veg: true,
                  },
                  {
                    name: "Student Union Café",
                    hours: "8 AM – 6 PM",
                    food: "Avocado toast & cold brew",
                    veg: true,
                  },
                  {
                    name: "The Commons Grill",
                    hours: "11 AM – 10 PM",
                    food: "Grilled chicken sandwich",
                    veg: false,
                  },
                ]
                  .filter((d) => filter === "All" || d.veg)
                  .map((d) => (
                    <article className="panel roomy" key={d.name}>
                      <Coffee className="dining-icon" size={38} />
                      <h2>{d.name}</h2>
                      <p className="muted">Sample hours · {d.hours}</p>
                      <div className="room-banner">
                        <div>
                          <span className="eyebrow">ON THE SAMPLE MENU</span>
                          <h3>{d.food}</h3>
                          {d.veg && (
                            <p>
                              <Leaf size={13} /> Vegetarian option
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            </>
          )}
          {["Safety & alerts", "Room booking", "Campus jobs"].includes(
            page,
          ) && (
            <section className="panel roomy integration">
              <span className="stat-icon blue">
                {page === "Safety & alerts" ? (
                  <ShieldCheck />
                ) : page === "Room booking" ? (
                  <DoorOpen />
                ) : (
                  <BriefcaseBusiness />
                )}
              </span>
              <span className="eyebrow">PLANNED CAMPUS INTEGRATION</span>
              <h2>
                {page === "Safety & alerts"
                  ? "A connected campus is a cared-for campus."
                  : page === "Room booking"
                    ? "Make room for your next great idea."
                    : "Your next opportunity, closer to home."}
              </h2>
              <p>
                {page === "Safety & alerts"
                  ? "University alerts, RA announcements, and links to existing campus safety services will live here. This prototype does not receive emergency alerts or send reports."
                  : page === "Room booking"
                    ? "Library study rooms and classroom availability will connect to your university’s booking system, with conflict detection and waitlists. Reservations are not available in this prototype."
                    : "Campus job listings, application tracking, and shift swaps will connect here after a university job source is selected."}
              </p>
              <div className="info-banner">
                A university and its official service integrations are needed to
                activate this module.
              </div>
            </section>
          )}
          <footer>
            <span className="footer-logo">
              <Leaf size={14} /> campo.
            </span>
            <span>A little less juggling. A lot more living.</span>
            <span>Made for campus life ↗</span>
          </footer>
        </main>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setModal("");
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="section-title">
              <h2 id="modal-title">
                {modal.startsWith("delete:")
                  ? "Remove expense?"
                  : (
                      {
                        task: "A little teamwork",
                        grocery: "Add to the grocery list",
                        expense: "Split an expense",
                        hangout: "Make a little time",
                        space: "Create a shared space",
                        maintenance: "Log a maintenance issue",
                        quiet: "Set quiet hours",
                        profile: "Make yourself at home",
                        dispute: "Talk it through",
                      } as Record<string, string>
                    )[modal]}
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal("")}
              >
                <X size={20} />
              </button>
            </div>
            {modal.startsWith("delete:") ? (
              <>
                <p>
                  This will remove the expense and recalculate everyone’s
                  balance.
                </p>
                <button
                  className="button primary"
                  onClick={() => {
                    editSpace((s) => ({
                      ...s,
                      expenses: s.expenses.filter(
                        (x) => x.id !== modal.split(":")[1],
                      ),
                    }));
                    setModal("");
                  }}
                >
                  Remove expense
                </button>
              </>
            ) : modal === "dispute" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = String(
                    new FormData(e.currentTarget).get("concern"),
                  ).trim();
                  if (!val) return;
                  editSpace((s) => ({
                    ...s,
                    history: [
                      `Concern · ${new Date().toLocaleString()}: ${val}`,
                      ...s.history,
                    ],
                  }));
                  setModal("");
                }}
              >
                <label>
                  What needs a conversation?
                  <textarea name="concern" required maxLength={500} autoFocus />
                </label>
                <p className="muted">
                  Saved in your local space history. No messages are sent.
                </p>
                <button className="button primary">Save concern</button>
              </form>
            ) : (
              <form onSubmit={submit}>
                {[
                  "task",
                  "grocery",
                  "expense",
                  "hangout",
                  "space",
                  "maintenance",
                ].includes(modal) && (
                  <label>
                    {modal === "space" ? "Space name" : "Name"}
                    <input
                      name="title"
                      placeholder={
                        modal === "task"
                          ? "e.g. Clean the kitchen"
                          : modal === "space"
                            ? "e.g. Cedar Hall · 312"
                            : "Give it a name"
                      }
                      required
                      maxLength={100}
                      autoFocus
                    />
                  </label>
                )}
                {modal === "task" && (
                  <div className="form-grid">
                    <label>
                      Assign to
                      <select name="owner">
                        {["Auto", ...members].map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Effort points
                      <select name="points">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
                {modal === "grocery" && (
                  <label>
                    Category
                    <select name="category">
                      {[
                        "Produce",
                        "Dairy & alternatives",
                        "Pantry",
                        "Household",
                        "Other",
                      ].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                )}
                {modal === "expense" && (
                  <>
                    <div className="form-grid">
                      <label>
                        Amount ($)
                        <input
                          name="amount"
                          type="number"
                          min="0.01"
                          max="100000"
                          step="0.01"
                          required
                        />
                      </label>
                      <label>
                        Paid by
                        <select name="payer">
                          {members.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="muted">
                      Split equally among You, Alex, Jordan, and Sam.
                    </p>
                  </>
                )}
                {modal === "hangout" && (
                  <label>
                    Suggested time
                    <input name="date" type="datetime-local" required />
                  </label>
                )}
                {modal === "quiet" && (
                  <div className="form-grid">
                    <label>
                      Start
                      <input
                        type="time"
                        name="start"
                        defaultValue="22:00"
                        required
                      />
                    </label>
                    <label>
                      End
                      <input
                        type="time"
                        name="end"
                        defaultValue="08:00"
                        required
                      />
                    </label>
                  </div>
                )}
                {modal === "space" && (
                  <p className="muted">
                    Creates an empty local space with the four demo roommates.
                    Invitations will require a backend.
                  </p>
                )}
                {modal === "profile" && (
                  <>
                    <label>
                      Your first name
                      <input
                        name="name"
                        required
                        maxLength={30}
                        defaultValue={state.name}
                        autoFocus
                      />
                    </label>
                    <label>
                      University email (optional)
                      <input
                        name="email"
                        type="email"
                        pattern="[^\s@]+@[^\s@]+\.[eE][dD][uU]"
                        title="Use a university email ending in .edu"
                        defaultValue={state.email}
                        placeholder="you@university.edu"
                      />
                    </label>
                    <div className="info-banner">
                      Demo profile only. An .edu address is format-checked, but
                      is not verified. No email is sent.
                    </div>
                  </>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setModal("")}
                  >
                    Cancel
                  </button>
                  <button className="button primary">
                    {modal === "profile" ? "Save profile" : "Save"}
                    <Check size={16} />
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

