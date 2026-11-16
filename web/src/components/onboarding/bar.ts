import type { Actor } from "../../lib/omega/actor";

/** Omega in setup. By default he lives on the progress bar: on the first step he comes in from the side and waves; at every step he gets to the new segment
 *  some different way each time, and keeps doing things at random while you fill the page in. Three things pull him off the bar:
 *    - when you click into a text field he hops down and perches on the top edge of its card, and his eyes follow what you type;
 *    - on the last step he grows and perches on the summary card, and when you press the button he hops onto it;
 *    - tap him and he reacts.
 *  He also reacts to what you do (a valid answer, a taken username, a choice, the theme). Nothing here depends on the look of the page, only on where things are. */
export type BarGeom = { xs: number[]; y: number };
export type Spot = { x: number; y: number };
export type Places = {
  geom: () => BarGeom | null;
  /** Make sure he can be drawn down to this height (null: only the bar needs drawing). */
  need: (y: number | null) => void;
  /** Where he stands on the card holding this field. */
  perchOf: (el: HTMLElement) => Spot | null;
  /** Where he stands on the last step, big. */
  finaleSpot: () => Spot | null;
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
type Weighted = [string, number][];
const SMALL = 0.3, PERCH = 0.34, BIG = 0.66;

/** What he does for fun, and how often. The clips are in public/omega/omega_clips.json (made by tools/omega). */
const FUN: Weighted = [
  ["hop", 3], ["smile", 3], ["blink", 3], ["wiggle", 2], ["nod", 2], ["bow", 1.4], ["perk", 2], ["look_around", 2.2], ["yawn", 1], ["shrug", 1], ["spin", 1.2], ["tap", 1],
  ["stomp", 0.7], ["startle", 0.6], ["flip", 0.8], ["backflip", 0.5], ["shake", 1], ["peek_l", 0.7], ["peek_r", 0.7], ["dizzy", 0.4], ["celebrate", 0.4], ["wave", 0.8],
];
/** Quiet things for while he is watching you type. */
const WATCHING: Weighted = [["blink", 4], ["nod", 1], ["perk", 1.2], ["shrug", 0.6], ["tap", 0.8], ["smile", 0.8]];
/** What he does when he is tapped. */
const POKED: Weighted = [["shake", 3], ["hop", 3], ["flip", 2], ["backflip", 1], ["startle", 2], ["spin", 1.6], ["wiggle", 1.4], ["nod", 1], ["stomp", 1], ["perk", 1], ["dizzy", 0.8], ["smile", 1]];
/** How he gets from one place on the bar to another. Each trip picks one, so no two look the same. */
const TRAVEL: Weighted = [["walk", 3.2], ["run", 2.2], ["hop", 3], ["leap", 1.6], ["skip", 1.4], ["flip", 0.7], ["backflip", 0.45], ["spin", 0.6]];

type Mode = "bar" | "perch" | "finale";

export class BarWalker {
  private run = 0;
  private at = 0;
  private step = 0;
  private lastStep = false;
  private lastMove = "";
  private lastMode = "";
  private started = false;
  /** He has got to his place for this step and said hello. Until then, a click into a field waits. */
  private free = false;
  private mode: Mode = "bar";
  private watching: HTMLElement | null = null;
  private unwatchTimer = 0;

  constructor(private actor: Actor, private p: Places) {}

  stop() { this.run++; window.clearTimeout(this.unwatchTimer); this.actor.cancel(); }

  private pick(from: Weighted = FUN, avoid = this.lastMove): string {
    const list = from.filter(([n]) => this.actor.has(n) && n !== avoid);
    const total = list.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [n, w] of list) { if ((r -= w) <= 0) { this.lastMove = n; return n; } }
    return "idle";
  }
  private pickMode(): string {
    const list = TRAVEL.filter(([n]) => (n === "walk" || n === "run" || n === "skip" || n === "leap" || this.actor.has(n)) && n !== this.lastMode);
    let r = Math.random() * list.reduce((s, [, w]) => s + w, 0);
    for (const [n, w] of list) { if ((r -= w) <= 0) { this.lastMode = n; return n; } }
    return "walk";
  }
  private wait(ms: number, alive: () => boolean) {
    return new Promise<void>((res) => { const end = performance.now() + ms; const tick = () => { if (!alive() || performance.now() >= end) res(); else window.setTimeout(tick, 100); }; tick(); });
  }
  private fieldAlive() { return !!this.watching && this.watching.isConnected; }

  /** Reduced motion, or just showing him: he stands on the segment, nothing else. */
  stand(i: number) {
    const g = this.p.geom();
    if (!g) return;
    this.at = i;
    this.actor.lockY = g.y;
    this.actor.teleport(g.xs[i], g.y).stand();
  }

  /** The window changed size or the page scrolled: keep him on whatever he is standing on. */
  refit() {
    const a = this.actor;
    const g = this.p.geom();
    if (!g) return;
    if (this.mode === "bar") {
      a.lockY = g.y;
      this.p.need(null);
      if (!a.busy) a.teleport(g.xs[Math.min(this.at, g.xs.length - 1)], g.y);
      return;
    }
    const spot = this.mode === "finale" ? this.p.finaleSpot() : this.fieldAlive() ? this.p.perchOf(this.watching!) : null;
    if (!spot) return;
    this.p.need(spot.y);
    a.pos.x = spot.x; a.pos.y = spot.y;
  }

  /** Is this screen point on him? */
  hit(x: number, y: number) {
    const p = this.actor.pos, s = this.actor.userScale;
    return this.started && Math.abs(x - p.x) < 88 * s && y > p.y - 170 * s && y < p.y + 30 * s;
  }

  /** He was tapped: he stops what he was doing, reacts in a way picked at random, then goes back to what he was doing. */
  async poke() {
    if (!this.started) return;
    const id = ++this.run;
    const a = this.actor;
    a.cancel();
    const first = this.pick(POKED, "");
    await a.play(first);
    if (id !== this.run) return;
    if (Math.random() < 0.3) {
      await a.play(this.pick(POKED, first));
      if (id !== this.run) return;
    }
    this.resume();
  }
  private resume() {
    if (this.mode === "finale") void this.finale(false);
    else if (this.mode === "perch" && this.fieldAlive()) void this.perch();
    else void this.arrive(this.step, { last: this.lastStep, greet: false });
  }

  /* ---------- what the page tells him ---------- */

  /** Something small happened on the page (a choice was made): sometimes he reacts, but he never breaks off a trip for it. */
  react(strong = false) {
    if (!this.started || this.actor.moving || this.actor.busy) return;
    if (!strong && Math.random() > 0.4) return;
    void this.actor.play(this.pick([["nod", 2], ["smile", 2], ["perk", 1], ["hop", 2], ["blink", 1], ["wiggle", 1], ["flip", 0.6]]));
  }
  /** The answer on this page is good: a smile or a nod. */
  valid() { void this.quick(["smile", "nod", "perk", "wiggle"]); }
  /** The answer is not allowed (a taken username): he shakes his head. */
  rejected() { void this.quick(["shake"]); }
  /** The look was chosen: dark makes him yawn, light perks him up. */
  theme(dark: boolean) { void this.quick(dark ? ["yawn"] : ["perk", "startle"]); }
  private reacting = false;
  private async quick(names: string[]) {
    const a = this.actor;
    if (!this.started || a.moving || this.reacting || (a.busy && this.mode === "bar")) return;
    const n = names.filter((x) => a.has(x));
    if (!n.length) return;
    this.reacting = true;
    a.cancel(); // whatever small thing he was doing, he drops it for this
    await a.play(n[Math.floor(Math.random() * n.length)], { face: 0 });
    this.reacting = false;
  }

  /** A text field got the cursor: after he has said hello, he hops down onto its card and watches. */
  watch(el: HTMLElement) {
    window.clearTimeout(this.unwatchTimer);
    this.watching = el;
    if (this.free && this.started && this.mode !== "finale") void this.perch();
  }
  /** The cursor left the field: if it does not come back soon he goes back to the bar. */
  unwatch() {
    window.clearTimeout(this.unwatchTimer);
    this.unwatchTimer = window.setTimeout(() => { if (!(document.activeElement instanceof HTMLInputElement)) { this.watching = null; this.actor.look = null; } }, 900);
  }
  /** Where the cursor (or the eyes of the person typing) is, so his eyes can follow. */
  lookAt(px: number, py: number) {
    const a = this.actor;
    const eyeY = a.pos.y - 64 * a.userScale / SMALL * 0.3;
    a.look = { x: Math.max(-1, Math.min(1, (px - a.pos.x) / 180)), y: Math.max(-1, Math.min(1, -(py - eyeY) / 90)) };
  }

  /* ---------- moving about ---------- */

  private async jump(to: Spot, alive: () => boolean): Promise<boolean> {
    const a = this.actor;
    a.lockY = null;
    // the peak of the jump grows with how far he goes, so a long drop is a proper leap (up, over, down) and a short step is a hop
    const d = Math.hypot(to.x - a.pos.x, to.y - a.pos.y);
    const arc = Math.min(150, 28 + 0.34 * d);
    return (await a.play("hop", { face: 0, glide: { to, arc, from: 0.2, until: 0.7 } })) && alive();
  }

  /** Get to `toX` along the bar, in one of several ways picked at random, a bit at a time for the ways that jump. */
  private async travel(toX: number, y: number, alive: () => boolean, only?: string): Promise<boolean> {
    const a = this.actor;
    for (let guard = 0; guard < 14 && alive(); guard++) {
      const dx = toX - a.pos.x, dist = Math.abs(dx);
      if (dist < 6) return true;
      const mode = only ?? this.pickMode();
      if (mode === "walk" || mode === "run") {
        const ok = await a.walkTo(toX, y, { straight: true, pace: mode === "run" ? "scurry" : Math.random() < 0.5 ? "brisk" : "amble" });
        if (!ok || !alive()) return false;
        continue;
      }
      if (mode === "skip") { // a hop and a few quick steps, a hop and a few quick steps
        const tx = a.pos.x + Math.sign(dx) * Math.min(dist, rnd(60, 130));
        if (!(await a.play("hop", { face: Math.sign(dx) * (Math.PI / 2), glide: { to: { x: tx, y }, arc: 12 + 0.2 * Math.abs(tx - a.pos.x), from: 0.2, until: 0.7 } })) || !alive()) return false;
        const sx = a.pos.x + Math.sign(toX - a.pos.x) * Math.min(Math.abs(toX - a.pos.x), rnd(30, 70));
        if (!(await a.walkTo(sx, y, { straight: true, pace: "scurry" })) || !alive()) return false;
        continue;
      }
      // a jump of some kind, each carrying him a stretch through the air. It faces the way he is going, or the viewer, at random; a flip can be forwards
      // or backwards from either.
      const clip = mode === "leap" ? "hop" : mode;
      const reach = mode === "hop" ? rnd(70, 150) : mode === "leap" ? rnd(130, 220) : mode === "spin" ? rnd(80, 150) : rnd(100, 190);
      const tx = a.pos.x + Math.sign(dx) * Math.min(dist, reach);
      const win = clip === "hop" ? { from: 0.2, until: 0.7 } : clip === "spin" ? { from: 0.17, until: 0.7 } : { from: 0.22, until: 0.76 };
      const face = mode === "leap" || Math.random() < 0.6 ? Math.sign(dx) * (Math.PI / 2) : 0; // along the bar, or to the viewer
      const ok = await a.play(clip, { face, glide: { to: { x: tx, y }, arc: (clip === "hop" ? 12 : 16) + 0.22 * Math.abs(tx - a.pos.x), ...win } });
      if (!ok || !alive()) return false;
    }
    return alive();
  }

  /** A new step: get to its segment, greet it, then carry on being himself until the step changes. */
  async arrive(i: number, o: { last: boolean; greet?: boolean }) {
    const id = ++this.run;
    const alive = () => id === this.run;
    const a = this.actor;
    const g = this.p.geom();
    if (!g) return;
    if (this.watching && !this.watching.isConnected) this.watching = null;
    this.step = i; this.lastStep = o.last;
    this.mode = "bar"; this.free = false;
    a.look = null; a.scaleGoal = SMALL;
    const firstTime = !this.started;
    this.started = true;
    if (firstTime) { this.p.need(null); a.lockY = g.y; a.teleport(-40, g.y); }
    // back up to the bar if he was down on a card
    if (Math.abs(a.pos.y - g.y) > 6) {
      if (!(await this.jump({ x: Math.min(Math.max(a.pos.x, g.xs[0]), g.xs[g.xs.length - 1]), y: g.y }, alive))) return;
    }
    a.lockY = g.y;
    this.p.need(null);
    if (!(await this.travel(g.xs[i] + (firstTime ? 0 : rnd(-8, 8)), g.y, alive, firstTime ? "walk" : undefined))) return;
    this.at = i;
    if (o.last && this.p.finaleSpot()) { void this.finale(o.greet !== false); return; }
    if (o.greet !== false) {
      if (firstTime) await a.play("wave");
      else await a.play(this.pick());
      if (!alive()) return;
    }
    this.free = true;
    if (this.fieldAlive()) { void this.perch(); return; }
    // then he keeps himself busy on his own step: a pause of a random length, then something else (sometimes two things), or a little shuffle along the
    // step he is on. He never goes back over the steps you have done or ahead to the ones you have not.
    while (alive()) {
      await this.wait(rnd(1400, 6200), alive);
      if (!alive()) return;
      const now = this.p.geom();
      if (!now) return;
      if (Math.random() < 0.28) {
        const step = now.xs.length > 1 ? now.xs[1] - now.xs[0] : 120;
        const x = now.xs[i] + rnd(-0.36, 0.36) * step; // somewhere on his own segment
        if (Math.abs(x - a.pos.x) > 20) {
          if (!(await this.travel(x, now.y, alive))) return;
          if (Math.random() < 0.5) await a.play(this.pick());
          continue;
        }
      }
      await a.play(this.pick());
      if (alive() && Math.random() < 0.25) await a.play(this.pick());
    }
  }

  /** On a card, watching you type: quiet blinks and the odd nod, eyes following the cursor. Goes back to the bar when the field loses the cursor. */
  private async perch() {
    const id = ++this.run;
    const a = this.actor;
    const field = this.watching;
    const spot = field && this.p.perchOf(field);
    if (!field || !spot) return;
    const alive = () => id === this.run && this.fieldAlive();
    this.mode = "perch"; this.free = true;
    this.p.need(spot.y);
    a.scaleGoal = PERCH;
    if (Math.abs(a.pos.y - spot.y) > 4 || Math.abs(a.pos.x - spot.x) > 6) {
      if (!(await this.jump(spot, alive))) { if (id === this.run) void this.leave(); return; }
    }
    a.pos.x = spot.x; a.pos.y = spot.y;
    const f = this.watching;
    if (f instanceof HTMLInputElement) { const r = f.getBoundingClientRect(); this.lookAt(r.left + 40, r.top + r.height / 2); }
    while (alive()) {
      await this.wait(rnd(1500, 4200), alive);
      while (alive() && this.reacting) await this.wait(150, alive);
      if (!alive()) break;
      await a.play(this.pick(WATCHING), { face: 0 });
    }
    if (id === this.run) void this.leave();
  }
  /** The cursor has gone: back up to the bar, once he has finished any reaction he was in the middle of. */
  private async leave() {
    const id = this.run;
    for (let i = 0; i < 40 && this.reacting && id === this.run; i++) await new Promise((r) => window.setTimeout(r, 100));
    if (id !== this.run) return;
    this.mode = "bar"; this.actor.look = null;
    void this.arrive(this.step, { last: this.lastStep, greet: false });
  }

  /** The last step: big, standing on the summary card, waving; then doing small things until something happens. */
  private async finale(greet: boolean) {
    const id = ++this.run;
    const alive = () => id === this.run;
    const a = this.actor;
    const spot = this.p.finaleSpot();
    if (!spot) return;
    this.mode = "finale"; this.free = true;
    this.p.need(spot.y);
    a.look = null;
    if (!(await this.jump(spot, alive))) return;
    a.pos.x = spot.x; a.pos.y = spot.y;
    // he does not just swell: he springs into the air (a somersault, a spin or a jump) and grows while he is up there, so he lands already big
    await this.wait(240, alive);
    const trick = this.pick([["flip", 3], ["hop", 2], ["backflip", 1.4], ["spin", 1.2]], "");
    const grow = window.setTimeout(() => { if (alive()) a.scaleGoal = BIG; }, 420);
    await a.play(trick, { face: 0 });
    window.clearTimeout(grow);
    if (!alive()) return;
    a.scaleGoal = BIG; // in case the move was cut short
    await this.wait(240, alive);
    if (greet && alive()) await a.play("wave", { face: 0 });
    while (alive()) {
      await this.wait(rnd(1800, 5200), alive);
      if (!alive()) return;
      await a.play(this.pick([["smile", 3], ["blink", 3], ["nod", 2], ["wiggle", 2], ["hop", 2], ["wave", 1.2], ["bow", 1], ["perk", 1.4], ["flip", 0.8], ["spin", 0.8], ["celebrate", 0.6], ["yawn", 0.4]]), { face: 0 });
    }
  }

  /** Your answers are being saved: he runs up and down the whole bar until the page changes, and the bar chases him with a glow. */
  async saving() {
    if (!this.started) return;
    const id = ++this.run;
    const alive = () => id === this.run;
    const a = this.actor;
    const g0 = this.p.geom();
    if (!g0) return;
    this.mode = "bar"; a.look = null; a.scaleGoal = SMALL;
    if (Math.abs(a.pos.y - g0.y) > 6) { if (!(await this.jump({ x: Math.min(Math.max(a.pos.x, g0.xs[0]), g0.xs[g0.xs.length - 1]), y: g0.y }, alive))) return; }
    a.lockY = g0.y; this.p.need(null);
    while (alive()) {
      const g = this.p.geom();
      if (!g) return;
      const toEnd = a.pos.x < (g.xs[0] + g.xs[g.xs.length - 1]) / 2;
      if (!(await a.walkTo(toEnd ? g.xs[g.xs.length - 1] : g.xs[0], g.y, { straight: true, pace: "scurry" }))) return;
    }
  }

  /** The button on the last step was pressed: he hops onto it and celebrates. */
  async finish(btn: DOMRect | undefined) {
    if (!this.started || !btn) return;
    const id = ++this.run;
    const alive = () => id === this.run;
    const a = this.actor;
    const spot = { x: btn.left + btn.width / 2, y: btn.top + 2 };
    this.p.need(spot.y);
    a.look = null; a.scaleGoal = 0.46; // a little smaller on the button, so he does not cover the card above it
    if (!(await this.jump(spot, alive))) return;
    a.pos.x = spot.x; a.pos.y = spot.y;
    await a.play("celebrate", { face: 0 });
    while (alive()) { await this.wait(rnd(800, 2000), alive); if (alive()) await a.play(this.pick([["hop", 3], ["wiggle", 2], ["flip", 1.2], ["smile", 2]]), { face: 0 }); }
  }
}
