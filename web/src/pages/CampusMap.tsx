import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CalendarPlus, Check, ExternalLink, MapPin, MapPinPlus, Search, ThumbsDown, X } from "lucide-react";
import Picker from "../components/Picker";
import { CATEGORY, loadMyCampus, type PlaceCategory } from "../lib/campus";
import { useMapPlaces, type MapPlace } from "../lib/mapPlaces";
import { NEEDED, proposalActions, tally } from "../lib/placeVotes";
import { notice } from "../lib/notice";
import { YOU } from "../lib/hangouts";

const ALL = "all" as const;
const NEEDS = "needs" as const;
const categoryOptions = (Object.keys(CATEGORY) as PlaceCategory[]).map((c) => ({ value: c, label: CATEGORY[c].label }));

/** The campus map for the signed-in student's own university. Tap Add a place, tap the map, name it, and other students confirm it. */
export default function CampusMap() {
  const nav = useNavigate();
  const { status, campus, places, live, open, source, error, partial, reviewed } = useMapPlaces();
  const [cat, setCat] = useState<PlaceCategory | typeof ALL | typeof NEEDS>(ALL);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PlaceCategory>("other");
  const [details, setDetails] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const draftLayer = useRef<L.LayerGroup | null>(null);
  const prevOpen = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<string[]>([]);
  const addingRef = useRef(false);
  addingRef.current = adding;

  const needsVote = useMemo(() => open.filter((p) => p.proposal!.by !== YOU && p.proposal!.votes[YOU] === undefined), [open]);
  const shown = useMemo(() => places.filter((p) => (cat === ALL || (cat === NEEDS ? needsVote.some((n) => n.id === p.id) : p.category === cat)) && p.name.toLowerCase().includes(q.trim().toLowerCase())), [places, cat, q, needsVote]);
  const picked = places.find((p) => p.id === sel);
  const used = useMemo(() => (Object.keys(CATEGORY) as PlaceCategory[]).filter((c) => places.some((p) => p.category === c)), [places]);

  // A place that was waiting for confirmations and has just gone live pulses once.
  useEffect(() => {
    const nowOpen = new Set(places.filter((p) => p.open).map((p) => p.id));
    const live = places.filter((p) => !p.open && prevOpen.current.has(p.id)).map((p) => p.id);
    prevOpen.current = nowOpen;
    if (live.length === 0) return;
    setFresh(live);
    const t = setTimeout(() => setFresh([]), 1800);
    return () => clearTimeout(t);
  }, [places]);

  // Make the map once the campus is known, and move it to that campus.
  useEffect(() => {
    if (!box.current || !campus) return;
    if (!map.current) {
      const m = L.map(box.current, { zoomControl: true, scrollWheelZoom: true }).setView(campus.center, campus.zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      draftLayer.current = L.layerGroup().addTo(m);
      m.on("click", (e: L.LeafletMouseEvent) => { if (addingRef.current) setDraft({ lat: e.latlng.lat, lng: e.latlng.lng }); });
      map.current = m;
    } else map.current.setView(campus.center, campus.zoom);
  }, [campus?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);
  useEffect(() => { map.current?.getContainer().classList.toggle("adding", adding); }, [adding, campus?.key]);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const p of shown) {
      const icon = L.divIcon({ className: "", html: `<span class="map-pin ${p.open ? "open" : ""} ${p.id === sel ? "on" : ""} ${fresh.includes(p.id) ? "pulse" : ""}" data-cat="${p.category}"></span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
      L.marker([p.lat, p.lng], { icon, title: p.open ? `${p.name} (needs confirming)` : p.name, keyboard: true }).on("click", (e) => { L.DomEvent.stopPropagation(e); if (!addingRef.current) setSel(p.id); }).addTo(g);
    }
  }, [shown, sel, campus?.key, fresh]);

  useEffect(() => {
    const g = draftLayer.current;
    if (!g) return;
    g.clearLayers();
    if (draft) L.marker([draft.lat, draft.lng], { icon: L.divIcon({ className: "", html: '<span class="map-pin draft"></span>', iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false }).addTo(g);
  }, [draft]);

  useEffect(() => { if (picked) map.current?.flyTo([picked.lat, picked.lng], Math.max(map.current.getZoom(), 18), { duration: 0.6 }); }, [picked?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function stopAdding() { setAdding(false); setDraft(null); setName(""); setDetails(""); setKind("other"); }

  function submit() {
    if (!draft || !campus) return;
    const r = proposalActions.propose({ campusKey: campus.key, name, category: kind, lat: draft.lat, lng: draft.lng, details }, places);
    if (r.ok) {
      stopAdding();
      setSel(r.id);
      notice.show({ icon: "pin", title: "Thanks, that is on the map", message: `It shows as a dashed pin until ${NEEDED} students confirm it is right. Then it becomes part of the campus map for everyone.`, ms: 6000 });
      return;
    }
    if (r.reason === "name") notice.show({ title: "Give it a name", message: "Use a name other students would recognize, between 2 and 60 characters." });
    else if (r.reason === "limit") notice.show({ title: "That is plenty for today", message: "You can add up to 5 places a day. Come back tomorrow, or confirm other people's places in the meantime." });
    else notice.show({ icon: "pin", title: "That place is already on the map", message: "Someone already added it right there. Open it and confirm instead of adding a copy.", actions: [{ label: "Show me", onClick: () => { stopAdding(); setSel(r.existing ?? null); } }] });
  }

  if (status === "none") {
    return (
      <div className="page"><h1 className="sr">Campus map</h1>
        <div className="map-empty"><h2>Join your campus first</h2><p>The map shows your own university. Tell us which one you attend on Home and it will appear here.</p><Link to="/app/feed" className="btn primary">Go to Home</Link></div>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="page"><h1 className="sr">Campus map</h1>
        <div className="map-empty"><h2>The map did not load</h2><p>{error}</p><button type="button" className="btn primary" onClick={() => loadMyCampus(true)}>Try again</button></div>
      </div>
    );
  }
  if (!campus) {
    return (
      <div className="page"><h1 className="sr">Campus map</h1>
        <div className="map-empty" role="status"><h2>Finding your campus</h2><p>Looking up the buildings. This takes a few seconds the first time.</p></div>
      </div>
    );
  }

  const t = picked?.proposal ? tally(picked.proposal) : null;
  const mine = picked?.proposal?.votes[YOU];
  const ownProposal = picked?.proposal?.by === YOU;

  return (
    <div className="page mapview">
      <h1 className="sr">Campus map</h1>
      <div className="map-grid">
        <aside className="map-side" aria-label="Places">
          <label className="map-search"><Search size={16} aria-hidden="true" /><span className="sr">Search places</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${campus.name}`} /></label>
          {needsVote.length > 0 && cat !== NEEDS && (
            <div className="map-vote-ask" role="status">
              <p><strong>{needsVote.length} {needsVote.length === 1 ? "place needs" : "places need"} your vote.</strong> Students added {needsVote.length === 1 ? "it" : "them"} and want to know if {needsVote.length === 1 ? "it is" : "they are"} right.</p>
              <button type="button" className="btn" onClick={() => { setCat(NEEDS); setSel(needsVote[0].id); }}>Review</button>
            </div>
          )}
          <div className="map-cats" role="group" aria-label="Filter places">
            <button type="button" aria-pressed={cat === ALL} onClick={() => setCat(ALL)}>All</button>
            {needsVote.length > 0 && <button type="button" className="needs" aria-pressed={cat === NEEDS} onClick={() => setCat(NEEDS)}>Needs your vote ({needsVote.length})</button>}
            {used.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>{CATEGORY[c].label}</button>)}
          </div>
          <ul className="map-list">
            {shown.map((p: MapPlace) => {
              const tl = p.proposal ? tally(p.proposal) : null;
              return (
                <li key={p.id}>
                  <button type="button" className={p.id === sel ? "on" : ""} aria-pressed={p.id === sel} onClick={() => setSel(p.id === sel ? null : p.id)}>
                    <span className={"map-dot" + (p.open ? " open" : "")} data-cat={p.category} aria-hidden="true" />
                    <span><strong>{p.name}</strong><em>{p.open && tl ? `Added by a student · ${tl.yes} of ${NEEDED} confirmations` : `${CATEGORY[p.category].label}${p.hours ? ` · ${p.hours}` : ""}`}</em></span>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="muted map-none">{places.length === 0 ? (partial ? "Building names have not loaded yet." : "No named buildings found for this campus yet. Add the first one.") : cat === NEEDS ? "You have voted on everything. Thank you." : "No places match that."}</li>}
          </ul>
          {partial && <div className="map-partial" role="status"><p>We found {campus.name} but could not load its building names right now. The map data service is busy.</p><button type="button" className="btn" onClick={() => loadMyCampus(true)}>Try again</button></div>}
          <p className="map-note">Place names and positions from OpenStreetMap and from students, not an official {campus.name} map.{(source === "openstreetmap" || reviewed === false) && " Categories are guesses and some buildings may be missing."}{campus.officialMapUrl && <> <a href={campus.officialMapUrl} target="_blank" rel="noreferrer">Official map <ExternalLink size={12} aria-hidden="true" /></a></>}</p>
        </aside>
        <section className="map-stage" aria-label="Map">
          <div ref={box} className="map-box" />
          <button type="button" className={"map-add" + (adding ? " on" : "")} aria-pressed={adding} onClick={() => (adding ? stopAdding() : (setAdding(true), setSel(null)))}>
            {adding ? <><X size={16} aria-hidden="true" />Cancel</> : <><MapPinPlus size={16} aria-hidden="true" />Add a place</>}
          </button>
          {adding && !draft && <div className="map-hint" role="status">Tap the map where the place is.</div>}
          {adding && draft && (
            <form className="map-card map-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <strong><MapPin size={15} aria-hidden="true" />Name this place</strong>
              <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="What do students call it?" maxLength={60} autoFocus /></label>
              <div className="field"><span id="place-kind">What is it?</span><Picker value={kind} options={categoryOptions} onChange={setKind} labelledBy="place-kind" id="place-kind-picker" compact /></div>
              <label className="field">Details, if you know them<input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Hours, what is inside, how to find it" maxLength={200} /></label>
              <div className="map-card-actions">
                <button className="btn primary" disabled={!name.trim()}>Add to the map</button>
                <button type="button" className="btn" onClick={() => setDraft(null)}>Move the pin</button>
              </div>
            </form>
          )}
          {!adding && picked && (
            <div className="map-card" data-cat={picked.category}>
              <strong><MapPin size={15} aria-hidden="true" />{picked.name}</strong>
              <p>{picked.blurb ?? CATEGORY[picked.category].label}</p>
              {picked.hours && <span className="map-hours">{picked.hours}</span>}
              {picked.open && t ? (
                <>
                  <div className="map-progress" role="img" aria-label={`${t.yes} of ${NEEDED} confirmations`}><i style={{ width: `${Math.min(100, (t.yes / NEEDED) * 100)}%` }} /></div>
                  <span className="map-hours">{t.yes} of {NEEDED} students confirmed{t.no > 0 ? `, ${t.no} said it is wrong` : ""}. Added by {picked.proposal!.by === YOU ? "you" : picked.proposal!.by}.</span>
                  <div className="map-card-actions">
                    {ownProposal ? (
                      <button type="button" className="btn" onClick={() => { proposalActions.withdraw(picked.id); setSel(null); }}>Take it back</button>
                    ) : (
                      <>
                        <button type="button" className="btn primary" aria-pressed={mine === 1} onClick={() => proposalActions.vote(picked.id, mine === 1 ? null : 1)}><Check size={16} aria-hidden="true" />{mine === 1 ? "You confirmed" : "Yes, that is right"}</button>
                        <button type="button" className="btn" aria-pressed={mine === -1} onClick={() => proposalActions.vote(picked.id, mine === -1 ? null : -1)}><ThumbsDown size={15} aria-hidden="true" />{mine === -1 ? "You said it is wrong" : "Not right"}</button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="map-card-actions">
                  <button type="button" className="btn primary" onClick={() => nav("/app/groups", { state: { place: picked.name } })}><CalendarPlus size={16} aria-hidden="true" />Plan a hangout here</button>
                  <a className="btn" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${picked.lat}&mlon=${picked.lng}#map=19/${picked.lat}/${picked.lng}`}>Open in maps</a>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      <p className="sr" aria-live="polite">{live.length} places on the map, {open.length} waiting for confirmation.</p>
    </div>
  );
}
