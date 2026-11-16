import * as THREE from "three";
import { loadOmega, type Expr, type OmegaModel } from "./model";

/** Omega as a character on the page, alive: the real 3D model, drawn live in a transparent canvas over the page.
 *
 *  What that buys over the pictures he used to be made of: he turns smoothly to any angle (not eight fixed views), his walk and his gestures are blended
 *  as skeleton poses (nothing pops between clips), his legs follow the animation exactly, he leans into turns, the lighting and the shadow are real, and
 *  everything stays sharp at any size. He is a few megabytes and a few draw calls, where the pictures were hundreds of megabytes of memory.
 *
 *  Everything he does is a promise, so a scene reads like a script:  await omega.walkTo(x, y);  await omega.play("wave");
 *  Cancelling (a new thing to react to) resolves whatever is pending with `false`.
 *
 *  Depth on the page: the canvas sits above the form pieces, and the pieces that are nearer to the viewer than he is (their bottom edge is lower on the
 *  screen than his feet) are cut out of the canvas with a clip-path, so he really does disappear behind them. */
export const SIN = 0.3387;          // the camera looks 19.8 degrees down: the ground is squashed by this much on the screen
export const COS = Math.sqrt(1 - SIN * SIN);
export const K = 366;               // screen pixels per world unit at scale 1
const wrap = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(l: readonly T[]): T => l[Math.floor(Math.random() * l.length)];
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export type Pace = "stalk" | "amble" | "brisk" | "scurry" | "dash";
const PACE: Record<Pace, [number, number]> = { stalk: [0.14, 0.2], amble: [0.2, 0.33], brisk: [0.34, 0.46], scurry: [0.5, 0.7], dash: [0.95, 1.15] };
export type Pt = { x: number; y: number };
/** A piece of the page that can hide him: its box on the screen, and its depth (the screen height of its bottom edge). */
export type Occluder = { l: number; t: number; r: number; b: number; depth: number };
type Meta = { frames: number; loop: boolean; speed: number; expr: Record<string, number>[]; gaze: number[][] };
type Job = { pts: { x: number; y: number; through: boolean }[]; cruise: number; paceMul: number[]; resolve: (ok: boolean) => void };
type Glide = { from: Pt; to: Pt; arc: number; a: number; b: number };
type One = { name: string; action: THREE.AnimationAction; hold: boolean; glide?: Glide; resolve: (ok: boolean) => void; done: boolean; settled?: boolean };
type Pending = { name: string; opts: PlayOpts; resolve: (ok: boolean) => void; face: number | null; by: number };
export type PlayOpts = { /** Turn to face this way first (radians; 0 is the viewer, +90 degrees is east) instead of the clip's usual facing. */ face?: number; flip?: boolean; loops?: number; hold?: boolean; glide?: { to: Pt; arc?: number; from?: number; until?: number } };
export type ActorOptions = { parent: HTMLElement; baseUrl: string; scale?: number; dark?: boolean; still?: boolean; /** The same size at every height on the screen (no nearer-is-bigger). */ flat?: boolean; /** Draw inside `parent` (a box he lives in) instead of across the whole window; positions are then in that box. */ inline?: boolean };
const ALIAS: Record<string, string> = { read_E: "read" };
/** Clips that face east or west (the page says which with `flip`); every other gesture faces the viewer. */
const SIDEWAYS = new Set(["read", "think"]);
/** Gestures that are said to the person looking at the page: he turns to face them first, wherever he was heading. */
const TO_VIEWER = new Set(["wave", "nod", "perk", "shrug", "startle", "celebrate", "stomp", "wince", "lowbat", "look_around", "dizzy", "blink", "smile", "wiggle", "bow", "yawn", "flip", "backflip", "shake", "hop", "spin"]);

export class Actor {
  pos: Pt = { x: 200, y: 400 };
  /** Extra height in pixels (standing on a ledge, or in a hop between ledges). */
  elev = 0;
  elevTarget = 0;
  userScale: number;
  sMin = 0.62;
  sMax = 1.0;
  zOverride: number | null = null;
  autoIdle = false;
  v = 0;
  occluders: () => Occluder[] = () => [];
  /** When set, his feet stay on this screen height however he walks (he is walking along a line). */
  lockY: number | null = null;
  /** Where his eyes should look (-1..1 each way), or null to let the clips decide. */
  look: { x: number; y: number } | null = null;
  private lookS = { x: 0, y: 0 };
  /** Show or hide his legs and tail, so that only the ball is left. */
  retract(on: boolean) {
    this.model?.root.traverse((o) => { if (/^(SpiderLeg_|Tail|Inner_Tail)/.test(o.name)) o.visible = !on; });
  }
  setShadow(on: boolean) { this.ground.visible = on; }
  /** Turn him into a ball of this colour with eyes of that one, p from 0 (himself) to 1 (done). */
  setTint(body: string, eye: string, p: number) { this.model?.setTint(body, eye, p); }
  /** Fade the whole drawing in or out. */
  setOpacity(v: number, ms = 0) { if (this.cvs) { this.cvs.style.transition = ms ? `opacity ${ms}ms ease` : ""; this.cvs.style.opacity = String(v); } }
  /** Where the middle of his ball is on the screen right now (px from the top left of the window), or null before he is ready. */
  ballCenter(): { x: number; y: number } | null {
    const body = this.model?.root.getObjectByName("Body_geo");
    if (!body) return null;
    const cam = this.cam.clone();
    cam.clearViewOffset();
    cam.updateProjectionMatrix();
    this.scene.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    body.getWorldPosition(p);
    p.project(cam);
    return { x: (p.x + 1) / 2 * this.vw(), y: (1 - p.y) / 2 * this.vh() };
  }
  /** Grow or shrink to this size, smoothly. */
  scaleGoal: number | null = null;
  /** When set, the canvas is only this many CSS pixels tall, from the top of the window (he lives in a strip), so it can be drawn at a high pixel density. */
  private bandH: number | null = null;
  private base: string;
  private opts: ActorOptions;
  private renderer: THREE.WebGLRenderer | null = null;
  readonly scene = new THREE.Scene();
  private cam: THREE.OrthographicCamera;
  private key: THREE.DirectionalLight;
  private ground: THREE.Mesh;
  private heading = new THREE.Group();   // at his feet, turned to the way he faces, scaled for how far away he is
  private lean = new THREE.Group();      // tilts him into turns and with his speed
  private model: OmegaModel | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private weight = new Map<string, number>();
  private meta = new Map<string, Meta>();
  private readyP: Promise<void>;
  private raf = 0;
  private last = performance.now();
  private dead = false;
  private psi = 0;
  private turn = 0;
  private vs = 0;
  private lastV = 0;
  private job: Job | null = null;
  private one: One | null = null;
  private pending: Pending | null = null;
  private act = 0;
  private t = 0;
  private hes = 0;
  private nextHes = rnd(2, 4);
  private noise = [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)];
  private faceTarget: number | null = null;
  private clipKey = "";
  private visible = true;
  private lastLean = { x: 0, z: 0 };
  private dark = false;
  private cvs: HTMLCanvasElement | null = null;

  constructor(o: ActorOptions) {
    this.opts = o;
    this.base = o.baseUrl;
    this.userScale = o.scale ?? 1;
    this.dark = !!o.dark;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
    this.cam.position.set(0, SIN * 8, COS * 8);
    this.cam.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x443322, 0.35));
    this.key = new THREE.DirectionalLight(0xfff1e0, 1.8);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    Object.assign(this.key.shadow.camera, { left: -1.3, right: 1.3, top: 1.3, bottom: -1.3, near: 0.5, far: 12 });
    this.key.shadow.radius = 6; this.key.shadow.bias = -0.0008;
    this.scene.add(this.key, this.key.target);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.4 }));
    this.ground.rotation.x = -Math.PI / 2; this.ground.receiveShadow = true;
    this.heading.add(this.lean);
    this.scene.add(this.ground, this.heading);
    this.pos = { x: this.vw() / 2, y: this.vh() * (o.inline ? 0.9 : 0.7) };
    this.readyP = this.init().catch((e) => { if (!this.dead) throw e; }); // being taken down mid-load is not an error
  }

  private async init() {
    const cv = document.createElement("canvas");
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = this.opts.inline ? "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none" : "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:100000";
    this.cvs = cv;
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "high-performance" });
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.NeutralToneMapping; // keeps the orange saturated
    r.toneMappingExposure = 0.9;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.resize();
    window.addEventListener("resize", this.onResize);
    if (this.opts.inline && typeof ResizeObserver !== "undefined") { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.opts.parent); }
    const [{ model, env }, json] = await Promise.all([
      loadOmega(this.base, r),
      fetch(this.base + "omega_clips.json").then((x) => x.json() as Promise<{ clips: Record<string, Meta> }>),
    ]);
    if (this.dead) { model.dispose(); return; }
    this.model = model;
    this.scene.environment = env; this.scene.environmentIntensity = 0.3;
    this.lean.add(model.root);
    this.mixer = new THREE.AnimationMixer(model.root);
    for (const c of model.clips) {
      const a = this.mixer.clipAction(c);
      a.enabled = true;
      a.setEffectiveWeight(0);
      this.actions.set(c.name, a);
      this.weight.set(c.name, 0);
      this.meta.set(c.name, json.clips[c.name]);
    }
    for (const n of ["idle", "walk", "skitter"]) this.actions.get(n)?.play();
    this.weight.set("idle", 1); this.actions.get("idle")?.setEffectiveWeight(1);
    this.mixer.addEventListener("finished", (e) => { const ev = e as unknown as { action: THREE.AnimationAction }; if (this.one && this.one.action === ev.action) this.one.done = true; });
    this.setDark(this.dark);
    r.domElement.style.display = this.visible ? "" : "none";
    this.opts.parent.appendChild(cv);
    if (this.opts.still) { this.pos = { x: this.vw() * 0.82, y: this.vh() * 0.8 }; this.frame(0); return; }
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private onResize = () => this.resize();
  private resize() {
    const r = this.renderer;
    if (!r) return;
    const w = this.vw(), H = this.vh(), h = !this.opts.inline && this.bandH ? Math.min(Math.ceil(this.bandH), H) : H;
    // sharp at any browser zoom or screen density: the pixel ratio follows the window every time it changes (zooming fires a resize)
    r.setPixelRatio(Math.min(Math.max((window.devicePixelRatio || 1) * 1.5, 2), 4)); // at least 2x, and half as much again on dense screens: he is small, so this is cheap, and it makes his edges crisp
    r.setSize(w, h, false);
    if (this.cvs && !this.opts.inline) { this.cvs.style.width = w + "px"; this.cvs.style.height = h + "px"; }
    this.cam.left = -w / 2 / K; this.cam.right = w / 2 / K; this.cam.top = H / 2 / K; this.cam.bottom = -H / 2 / K;
    this.cam.setViewOffset(w, H, 0, 0, w, h);
    this.cam.updateProjectionMatrix();
  }
  /** Draw only the top `h` pixels of the window. */
  setBand(h: number | null) { if (h === this.bandH) return; this.bandH = h; this.resize(); }

  /* ---------- look ---------- */
  setDark(d: boolean) {
    this.dark = d;
    (this.ground.material as THREE.ShadowMaterial).opacity = d ? 0.6 : 0.38;
    this.key.intensity = d ? 1.6 : 1.8;
    if (this.renderer) this.renderer.toneMappingExposure = d ? 0.85 : 0.92;
    this.model?.setDark(d);
  }
  setVisible(v: boolean) { this.visible = v; if (this.cvs) this.cvs.style.display = v ? "" : "none"; }
  private ro: ResizeObserver | null = null;
  destroy() {
    this.ro?.disconnect();
    this.dead = true; cancelAnimationFrame(this.raf); window.removeEventListener("resize", this.onResize);
    this.cancel();
    this.model?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.cvs?.remove();
  }
  scaleAt(y: number) { if (this.opts.flat) return 0.67 * this.userScale; return (this.sMin + (this.sMax - this.sMin) * clamp(y / this.vh(), 0, 1)) * this.userScale; }
  /** The size of the place he lives in: the window, or his box. */
  private vw() { return this.opts.inline ? this.opts.parent.clientWidth || 1 : innerWidth; }
  private vh() { return this.opts.inline ? this.opts.parent.clientHeight || 1 : innerHeight; }
  teleport(x: number, y: number) { this.pos = { x, y }; this.zOverride = null; this.cancel(); this.one = null; return this; }

  /* ---------- clips ---------- */
  ready(): Promise<void> { return this.readyP; }
  has(name: string) { return this.meta.has(ALIAS[name] ?? name); }
  /** Waits for the model to be loaded (everything is in the one file, so there is nothing else to fetch). */
  async loadNow(_names?: string[], ms = 12000): Promise<void> { void _names; await Promise.race([this.readyP, new Promise((r) => window.setTimeout(r, ms))]); }
  preload(_names?: string[]) { void _names; }

  /* ---------- things to do ---------- */
  cancel() {
    this.act++;
    const j = this.job, o = this.one, p = this.pending;
    this.job = null; this.pending = null;
    if (this.one && !this.one.hold) this.one = null; else if (this.one) this.one.done = true;
    j?.resolve(false); o?.resolve(false); p?.resolve(false);
  }
  /** The pieces of the page are solid: his feet cannot go through one. If the straight way from `a` to `b` crosses a piece, this finds the way around
   *  (shortest path past the corners of the pieces, kept a body's width away). Null when the straight way is clear, or when he starts or ends on a piece
   *  (up on a card, or at a spot the script chose on purpose). */
  private route(a: Pt, b: Pt): Pt[] | null {
    const m = 0.2 * K * this.scaleAt((a.y + b.y) / 2);
    const inside = (p: Pt, o: { l: number; r: number; t: number; b: number }) => p.x > o.l + 1 && p.x < o.r - 1 && p.y > o.t + 1 && p.y < o.b - 1;
    // Each piece is kept a body's width away. A piece he is already standing near (or is walking to on purpose) is only kept off by its own edge.
    const box = this.occluders().filter((o) => o.r - o.l > 24 && o.b - o.t > 30).map((o) => {
      // below a piece he stays far enough down that only his head and shoulders overlap it (he is drawn in front of it), not his whole body
      const wide = { l: o.l - m, r: o.r + m, t: o.t - 4, b: o.b + 0.5 * 0.62 * K * this.scaleAt(o.b + 80) };
      return inside(a, wide) || inside(b, wide) ? { l: o.l, r: o.r, t: o.t, b: o.b + 4 } : wide;
    });
    if (box.some((o) => inside(a, o) || inside(b, o))) return null;
    const hits = (p: Pt, q: Pt, o: { l: number; r: number; t: number; b: number }) => {
      let t0 = 0, t1 = 1;
      const dx = q.x - p.x, dy = q.y - p.y;
      for (const [d, lo, hi, s] of [[dx, o.l + 1, o.r - 1, p.x], [dy, o.t + 1, o.b - 1, p.y]] as const) {
        if (Math.abs(d) < 1e-6) { if (s <= lo || s >= hi) return false; continue; }
        let u = (lo - s) / d, v = (hi - s) / d;
        if (u > v) [u, v] = [v, u];
        t0 = Math.max(t0, u); t1 = Math.min(t1, v);
        if (t0 >= t1) return false;
      }
      return true;
    };
    const free = (p: Pt, q: Pt) => !box.some((o) => hits(p, q, o));
    if (free(a, b)) return null;
    const nodes: Pt[] = [a, b];
    for (const o of box) for (const [x, y] of [[o.l - 2, o.t - 2], [o.r + 2, o.t - 2], [o.l - 2, o.b + 2], [o.r + 2, o.b + 2]]) {
      const p = { x, y };
      if (x > 20 && x < this.vw() - 20 && y > 20 && y < this.vh() - 20 && !box.some((q) => inside(p, q))) nodes.push(p);
    }
    const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), seen = nodes.map(() => false);
    dist[0] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!seen[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0 || u === 1) break;
      seen[u] = true;
      for (let v = 0; v < nodes.length; v++) {
        if (seen[v]) continue;
        const d = dist[u] + Math.hypot(nodes[u].x - nodes[v].x, (nodes[u].y - nodes[v].y) * 1.6);
        if (d < dist[v] && free(nodes[u], nodes[v])) { dist[v] = d; prev[v] = u; }
      }
    }
    if (prev[1] < 0) return null;
    const out: Pt[] = [];
    for (let i = prev[1]; i > 0; i = prev[i]) out.unshift(nodes[i]);
    return out;
  }
  /** Walk to a point (feet position on screen). The path bends a little, the speed wanders, and he sometimes hesitates, unless told otherwise. */
  walkTo(x: number, y: number, o: { pace?: Pace; bend?: number; straight?: boolean } = {}): Promise<boolean> {
    this.cancel();
    this.one = null; // setting off lets go of a pose that was being held
    const pace = o.pace ?? pick<Pace>(["amble", "amble", "brisk"]);
    const cruise = rnd(...PACE[pace]);
    const dx = x - this.pos.x, dy = y - this.pos.y, dist = Math.hypot(dx, dy);
    const pts: Job["pts"] = [];
    const around = o.straight ? null : this.route({ x: this.pos.x, y: this.pos.y }, { x, y });
    if (around) {
      for (const p of around) pts.push({ ...p, through: true });
    } else if (!o.straight && dist > 160) {
      const bend = (o.bend ?? rnd(0.12, 0.3)) * (Math.random() < 0.5 ? -1 : 1);
      const nx = -dy / dist, ny = dx / dist;
      const cx = this.pos.x + dx / 2 + nx * dist * bend, cy = this.pos.y + dy / 2 + ny * dist * bend * 0.6;
      const n = Math.max(2, Math.round(dist / 130));
      for (let i = 1; i < n; i++) {
        const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
        pts.push({ x: a * this.pos.x + b * cx + c * x, y: a * this.pos.y + b * cy + c * y, through: true });
      }
    }
    pts.push({ x, y, through: false });
    return new Promise((resolve) => { this.job = { pts, cruise, paceMul: pts.map(() => rnd(0.85, 1.18)), resolve }; });
  }
  /** Play a clip once (or `loops` times). Clips that face sideways (read, think) turn him east, or west with `flip`; the others face the viewer. He turns
   *  first, then plays. `hold` keeps the last pose until the next thing he does. Resolves when it ends, false if cancelled. */
  play(name: string, o: PlayOpts = {}): Promise<boolean> {
    const real = ALIAS[name] ?? name;
    this.cancel();
    if (!this.meta.has(real)) return Promise.resolve(false);
    const face = o.face !== undefined ? o.face : SIDEWAYS.has(real) ? (o.flip ? -Math.PI / 2 : Math.PI / 2) : (o.flip !== undefined || TO_VIEWER.has(real) ? 0 : null);
    return new Promise((resolve) => { this.pending = { name: real, opts: o, resolve, face, by: performance.now() + 700 }; if (face !== null) this.faceTarget = face; });
  }
  /** Play the first of these clips that exists. Resolves false if none does. */
  playAny(names: string[], o: PlayOpts = {}): Promise<boolean> {
    const n = names.find((x) => this.has(x));
    return n ? this.play(n, o) : Promise.resolve(false);
  }
  /** Stand still. */
  stand() { this.cancel(); this.one = null; }
  /** Walk on the spot at this speed (world units a second, like the walking paces), or null to stop. He does not move, but the legs do, and `groundSpeed`
   *  says how fast the ground under his feet should be sliding past. */
  forcedV: number | null = null;
  treadmill(v: number | null) { this.forcedV = v; }
  /** How fast the floor should move under him, in screen pixels a second (0 while he is doing a gesture). */
  groundSpeed() { return this.forcedV === null || (this.one && !this.one.done) ? 0 : this.forcedV * K * this.scaleAt(this.pos.y); }
  /** Face this way (radians: 0 toward the viewer, 90 degrees to the right) without turning gradually. */
  setHeading(rad: number) { this.psi = rad; this.faceTarget = null; }
  raise(px: number) { this.elevTarget = px; }
  get moving() { return !!this.job || this.v > 0.05; }
  get busy() { return !!this.job || !!this.one || !!this.pending; }
  current() { return this.one?.name ?? (this.job ? (this.vs > 0.46 ? "skitter" : "walk") : "idle"); }

  /* ---------- motion ---------- */
  private worldVec(tx: number, ty: number) {
    const s = this.scaleAt(this.pos.y);
    return { x: (tx - this.pos.x) / (K * s), y: -(ty - this.pos.y) / (K * s * SIN) };
  }
  private startOne(p: Pending) {
    const a = this.actions.get(p.name)!;
    const m = this.meta.get(p.name)!;
    if (this.one) this.one.done = true;
    a.reset();
    a.setLoop(m.loop || (p.opts.loops ?? 1) > 1 ? THREE.LoopRepeat : THREE.LoopOnce, m.loop || (p.opts.loops ?? 1) > 1 ? (p.opts.loops ?? 1) : 1);
    a.clampWhenFinished = true;
    a.play();
    const g = p.opts.glide;
    this.one = { name: p.name, action: a, hold: !!p.opts.hold, resolve: p.resolve, done: false, glide: g ? { from: { ...this.pos }, to: g.to, arc: g.arc ?? 70, a: g.from ?? 0.22, b: g.until ?? 0.68 } : undefined };
    this.pending = null;
  }

  private loop(now: number) {
    if (this.dead) return;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    if (this.visible) this.frame(dt); // hidden (scrolled away, or his box is off screen): no work
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private frame(dt: number) {
    this.t += dt;
    let moving = false;
    // ---- a gesture waiting for him to turn
    if (this.pending && !this.one) {
      const p = this.pending;
      const err = p.face === null ? 0 : Math.abs(wrap(p.face - this.psi));
      if (err < 0.1 || performance.now() > p.by) this.startOne(p);
      else this.v = Math.max(0, this.v - 3 * dt);
    }
    if (this.faceTarget !== null && !this.job) {
      const err = wrap(this.faceTarget - this.psi), rate = Math.PI * 2.6;
      this.psi = wrap(this.psi + clamp(err, -rate * dt, rate * dt));
      this.turn = clamp(err / 0.6, -1, 1) * 0.6;
      if (Math.abs(err) < 0.01) this.faceTarget = null;
    }
    // a clip that has run to its end (the mixer says so) is over: tell whoever was waiting for it, and let go of it unless it is being held
    if (this.one && this.one.done && !this.one.settled) {
      const o = this.one;
      o.settled = true;
      if (!o.hold) this.one = null;
      o.resolve(true);
    }
    if (this.one && !this.one.done) {
      const a = this.one.action, dur = a.getClip().duration;
      this.v = 0;
      const g = this.one.glide;
      if (g) { // a hop that carries him: up onto a ledge or down again
        // a real jump: steady speed across, and a parabola for the height (a rise, a peak, a fall), not an eased slide
        const k = clamp((a.time / dur - g.a) / (g.b - g.a), 0, 1);
        this.pos.x = g.from.x + (g.to.x - g.from.x) * k; this.pos.y = g.from.y + (g.to.y - g.from.y) * k;
        this.elev = g.arc * 4 * k * (1 - k); this.elevTarget = 0;
      }
      if (this.one.done || (!a.isRunning() && a.time >= dur - 0.02 && a.loop === THREE.LoopOnce)) {
        const o = this.one;
        o.settled = true;
        if (!o.hold) this.one = null;
        else this.one = { ...o, done: true };
        o.resolve(true);
      }
    } else if (this.job) {
      const tg = this.job.pts[0];
      const w = this.worldVec(tg.x, tg.y);
      const dist = Math.hypot(w.x, w.y);
      if (dist < (tg.through ? 0.3 : 0.05)) {
        this.job.pts.shift(); this.job.paceMul.shift();
        if (!this.job.pts.length) { const j = this.job; this.job = null; j.resolve(true); }
      } else {
        const des = Math.atan2(w.x / dist, -w.y / dist);
        const err = wrap(des - this.psi);
        const rate = this.v > 0.05 ? Math.PI * 1.9 : Math.PI * 3.2;
        const step = clamp(err, -rate * dt, rate * dt);
        this.psi = wrap(this.psi + step);
        this.turn += (clamp(step / Math.max(dt, 1e-3) / 3, -1, 1) - this.turn) * Math.min(1, dt * 8);
        this.faceTarget = null;
        this.hes -= dt; this.nextHes -= dt;
        if (this.nextHes <= 0 && dist > 0.5 && this.job.cruise < 0.6) { this.hes = rnd(0.25, 0.6); this.nextHes = rnd(2.5, 5.5); }
        const n = this.noise;
        let vdes = this.job.cruise * this.job.paceMul[0] * (1 + 0.16 * Math.sin(this.t * 1.3 + n[0]) + 0.1 * Math.sin(this.t * 2.9 + n[1]) + 0.05 * Math.sin(this.t * 6.3 + n[2]));
        const dashing = this.job.cruise > 0.8;
        vdes = clamp(vdes, 0.15, dashing ? 1.2 : 0.72);
        if (this.hes > 0) vdes = Math.max(vdes * 0.5, 0.15); // a hesitation is a slower step, not a stop
        vdes *= clamp(1 - Math.abs(err) / 1.5, 0.35, 1);
        if (!tg.through || this.job.pts.length === 1) vdes = Math.min(vdes, Math.max(Math.sqrt(2 * (dashing ? 3 : 1.6) * Math.max(dist - 0.02, 0)), 0));
        const acc = vdes > this.v ? (dashing ? rnd(2.6, 3.2) : rnd(1.2, 1.8)) : dashing ? 3.4 : 2.2;
        this.v += clamp(vdes - this.v, -acc * dt, acc * dt);
        const s = this.scaleAt(this.pos.y), st = this.v * dt;
        this.pos.x = clamp(this.pos.x + Math.sin(this.psi) * st * K * s, 10, this.vw() - 10);
        this.pos.y = clamp(this.pos.y + Math.cos(this.psi) * st * K * s * SIN, this.opts.inline ? -200 : 60, this.vh() - 4);
        moving = this.v > 0.04;
      }
    } else {
      this.v = Math.max(0, this.v - 2.6 * dt);
      this.turn *= Math.max(0, 1 - dt * 8);
    }
    this.vs += (this.v - this.vs) * Math.min(1, dt * 6);
    this.elev += (this.elevTarget - this.elev) * Math.min(1, dt * 11);
    if (Math.abs(this.elev - this.elevTarget) < 0.3) this.elev = this.elevTarget;
    void moving;
    this.animate(dt);
    this.place(dt);
    this.render();
  }

  /** Blend the clips: he stands, walks or skitters by his speed, or a gesture takes over; the feet keep pace with the ground. */
  private animate(dt: number) {
    const m = this.mixer;
    if (!m) return;
    const target = new Map<string, number>();
    if (this.one && !this.one.done) target.set(this.one.name, 1);
    else if (this.one && this.one.hold) target.set(this.one.name, 1);
    else {
      const v = this.forcedV ?? this.vs, move = smooth(0.03, 0.12, v), fast = smooth(0.42, 0.56, v);
      target.set("idle", 1 - move); target.set("walk", move * (1 - fast)); target.set("skitter", move * fast);
    }
    const rate = 1 - Math.exp(-dt / (this.one && !this.one.done ? 0.1 : 0.16));
    let sum = 0;
    this.weight.forEach((w, n) => {
      const nw = w + ((target.get(n) ?? 0) - w) * rate;
      this.weight.set(n, nw < 0.002 ? 0 : nw);
      sum += this.weight.get(n)!;
    });
    this.weight.forEach((w, n) => { const a = this.actions.get(n)!; a.setEffectiveWeight(sum > 0 ? w / sum : 0); });
    const wm = this.meta.get("walk")!, sm = this.meta.get("skitter")!;
    const vv = this.forcedV ?? this.vs;
    this.actions.get("walk")!.timeScale = clamp(vv / wm.speed, 0.5, 1.7);
    this.actions.get("skitter")!.timeScale = clamp(vv / sm.speed, 0.6, 2.2);
    m.update(dt);
    // the face follows the clip that is most in charge
    let best = "idle", bw = -1;
    this.weight.forEach((w, n) => { if (w > bw) { bw = w; best = n; } });
    const meta = this.meta.get(best), a = this.actions.get(best);
    if (meta && a && this.model) {
      const f = clamp(Math.floor((a.time / a.getClip().duration) * meta.frames), 0, meta.frames - 1);
      this.model.setExpression((meta.expr[f] ?? {}) as Partial<Record<Expr, number>>);
      const g = meta.gaze[f] ?? [0, 0];
      const tx = this.look ? this.look.x * 2.4 : g[0], ty = this.look ? this.look.y * 2.2 : g[1]; // looking at something moves the eyes further than the clips do
      const k = 1 - Math.exp(-dt / 0.07);
      this.lookS.x += (tx - this.lookS.x) * k; this.lookS.y += (ty - this.lookS.y) * k;
      this.model.setGaze(this.lookS.x, this.lookS.y);
    }
  }

  /** Put him where he is on the screen, turned the way he faces, the size his distance gives him, leaning into turns. */
  private place(dt: number) {
    if (this.lockY !== null) this.pos.y = this.lockY;
    if (this.scaleGoal !== null) {
      this.userScale += (this.scaleGoal - this.userScale) * (1 - Math.exp(-dt / 0.22));
      if (Math.abs(this.scaleGoal - this.userScale) < 0.003) { this.userScale = this.scaleGoal; this.scaleGoal = null; }
    }
    const s = this.scaleAt(this.pos.y);
    const W = this.vw(), H = this.vh();
    const X = (this.pos.x - W / 2) / K, Z = (this.pos.y - H / 2) / (K * SIN);
    this.heading.position.set(X, (this.elev / K) / COS, Z);
    this.heading.rotation.y = this.psi;
    this.heading.scale.setScalar(s);
    // lean: into the turn, and forward a little when going fast; eased so it never twitches
    const wantZ = -this.turn * 0.1, wantX = clamp(this.vs - 0.25, 0, 0.5) * 0.12;
    const k = 1 - Math.exp(-dt / 0.15);
    this.lastLean.z += (wantZ - this.lastLean.z) * k; this.lastLean.x += (wantX - this.lastLean.x) * k;
    this.lean.rotation.set(this.lastLean.x, 0, this.lastLean.z);
    this.ground.position.set(X, 0, Z);
    // the shadow map only needs to cover him, and he is small: a tight map keeps the shadow sharp
    const ext = 1.45 * s, sc = this.key.shadow.camera;
    if (Math.abs(sc.right - ext) > ext * 0.04) { Object.assign(sc, { left: -ext, right: ext, top: ext, bottom: -ext, near: 0.1 * s, far: 9 * s }); sc.updateProjectionMatrix(); }
    this.key.position.set(X - 0.9 * s, 3.4 * s, Z + 1.3 * s); // high and a little to the left and front: a short shadow falling to the right and back
    this.key.target.position.set(X, 0, Z);
    this.key.target.updateMatrixWorld();
  }

  private render() {
    const r = this.renderer;
    if (!r || !this.visible) return;
    r.render(this.scene, this.cam);
    this.occlude();
  }

  /** Cut out of the canvas the pieces of the page that are nearer to the viewer than he is (their bottom edge is lower on the screen than his feet), so he
   *  passes behind them. Only the ones that overlap him are cut. */
  private occlude() {
    const cv = this.cvs;
    if (!cv) return;
    const depth = this.zOverride ?? this.pos.y;
    const s = this.scaleAt(this.pos.y) * K;
    const box = { l: this.pos.x - 1.2 * s, r: this.pos.x + 1.2 * s, t: this.pos.y - 1.5 * s - this.elev, b: this.pos.y + 0.4 * s };
    const hit = this.occluders().filter((o) => o.depth > depth + 1 && o.r > box.l && o.l < box.r && o.b > box.t && o.t < box.b);
    const key = hit.length ? hit.map((o) => `${o.l | 0},${o.t | 0},${o.r | 0},${o.b | 0}`).join("|") : "";
    if (key === this.clipKey) return;
    this.clipKey = key;
    if (!hit.length) { cv.style.clipPath = "none"; return; }
    const W = this.vw(), H = this.vh();
    cv.style.clipPath = `path(evenodd, "M0 0H${W}V${H}H0Z ${hit.map((o) => `M${o.l.toFixed(1)} ${o.t.toFixed(1)}H${o.r.toFixed(1)}V${o.b.toFixed(1)}H${o.l.toFixed(1)}Z`).join(" ")}")`;
  }
}
