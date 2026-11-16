"""Omega's walk v2: every foot has its own step timing, step length, height and sideways flare, and the body speeds up and slows down inside the cycle.

The original sprite walk had four feet at fixed quarter-cycle offsets, so it read as one stiff crawl. Here each foot is its own little state machine:
it is planted in the world (so it never slides), then lifts, swings along an arc and lands somewhere slightly different each time. A search over random
schedules picks one where at most two feet are ever in the air and the stance never collapses, and where the steps are as uneven as that allows.
The cycle still loops (every foot's pattern repeats each loop and the body advances exactly D), so it plays as a clean sprite loop.
"""
import random
from common import *  # noqa: F401,F403

PI = math.pi
FOOT_NAMES = ["FL", "FR", "BL", "BR"]
DIRS = {"S": (0, -1), "E": (1, 0), "W": (-1, 0), "N": (0, 1), "SE": (1, -1), "SW": (-1, -1), "NE": (1, 1), "NW": (-1, 1)}


def yaw_for(dx, dy):
    """The body turns toward where it is going, but never all the way round (the camera looks from the front): same mapping as the original clips."""
    phi = math.degrees(math.atan2(dx, -dy))
    a = abs(phi)
    y = a * 65 / 90 if a <= 90 else 65 + (a - 90) * 115 / 90
    return math.copysign(y, phi) if phi != 0 else 0


def body_profile(N, D, rng, surge):
    """Body position along the heading at each frame 0..N (b[N] == D). The speed surges and eases inside the cycle."""
    u = np.arange(N) / N
    p1, p2 = rng.uniform(0, 2 * PI), rng.uniform(0, 2 * PI)
    v = 1 + surge * np.sin(2 * PI * 2 * u + p1) + 0.45 * surge * np.sin(2 * PI * 3 * u + p2)
    b = np.concatenate([[0.0], np.cumsum(v)])
    return b / b[-1] * D


def bint(b, t, N, D):
    """b at a fractional frame t, extended past the loop (b(t+N) = b(t) + D)."""
    j = math.floor(t / N)
    tt = t - j * N
    i = int(tt)
    f = tt - i
    lo = b[i]
    hi = b[i + 1] if i + 1 <= N else b[N]
    return lo + (hi - lo) * f + j * D


def smooth(a, sigma):
    """Smooth a looping series (the clip repeats, so the ends wrap round)."""
    a = np.asarray(a, float)
    if sigma <= 0:
        return a
    r = int(math.ceil(sigma * 3))
    w = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    w /= w.sum()
    return np.convolve(np.concatenate([a[-r:], a, a[:r]]), w, mode="valid")


def plan(N, steps, swing, rng, D, b, tries=6000):
    """Pick when each foot lifts and how long it swings, with the legs able to move independently but never through each other.

    At rest the front and back leg on the same side are only about 0.07 apart, so if they step on their own schedules they pass through one another
    (that was the "legs stuck together"). So on each side the front foot leads and the back foot follows a few frames behind, landing a little short of
    where the front one did; that keeps the pair in order. What is free: how far the left pair is out of step with the right pair, each step's
    timing, length, height and flare, and how long the back foot waits. Many random schedules are tried; each must keep at most two feet in the air and
    keep every same-side pair in order all the way round, and the most uneven one wins."""
    best, best_score = None, -1.0
    for _ in range(tries):
        sched = {n: [] for n in FOOT_NAMES}
        for side in ("L", "R"):
            F, B = "F" + side, "B" + side
            t0 = rng.uniform(0, N / steps)
            for s_ in range(steps):
                tf = (t0 + s_ * N / steps + rng.uniform(-0.12, 0.12) * N / steps) % N
                wf, wb = swing * rng.uniform(0.85, 1.2), swing * rng.uniform(0.85, 1.2)
                lag = rng.uniform(1.5, 5.0)
                ahead_b = rng.uniform(0.0, 0.05)
                advance = (D / N) * (lag + wb - wf)  # how far the body goes between the front foot landing and the back foot landing
                ahead_f = ahead_b + max(0.0, advance) + rng.uniform(0.0, 0.03)
                sched[F].append({"lift": tf, "w": wf, "ahead": ahead_f, "h": rng.uniform(0.11, 0.18), "flare": rng.uniform(0.02, 0.05)})
                sched[B].append({"lift": (tf + lag) % N, "w": wb, "ahead": ahead_b, "h": rng.uniform(0.11, 0.18), "flare": rng.uniform(0.02, 0.05)})
        air = np.zeros((4, N), dtype=int)
        for fi, n in enumerate(FOOT_NAMES):
            for e in sched[n]:
                for k in range(N):
                    for sh in (-N, 0, N):
                        if e["lift"] <= k + sh < e["lift"] + e["w"]:
                            air[fi, k] = 1
        tot = air.sum(axis=0)
        if tot.max() > 2 or (tot == 0).sum() > 0.35 * N:
            continue
        lo = 9.0
        for side in ("L", "R"):
            for k in range(N):
                lo = min(lo, foot_state("F" + side, k, sched, b, N, D)[0] - foot_state("B" + side, k, sched, b, N, D)[0])
        if lo < 0.004:
            continue
        starts = sorted(e["lift"] for n in FOOT_NAMES for e in sched[n])
        gaps = np.diff(starts + [starts[0] + N])
        score = float(np.std(gaps)) + 0.3 * float(np.std([e["w"] for n in FOOT_NAMES for e in sched[n]])) + 4.0 * lo
        if score > best_score:
            best, best_score = sched, score
    return best


def foot_state(n, k, sched, b, N, D):
    """(rel, lift, flare) for foot n at frame k: rel is its position along the heading relative to its home spot under the body.
    A planted foot stays where it landed in the world (so it never slides); a swinging foot travels from the last landing to the next along an arc."""
    ev = []
    for j in (-1, 0, 1):
        for e in sched[n]:
            L = e["lift"] + j * N
            A = L + e["w"]
            ev.append((L, A, bint(b, A, N, D) + e["ahead"], e["h"], e["flare"]))
    ev.sort(key=lambda x: x[0])
    bt = bint(b, k, N, D)
    for i in range(1, len(ev)):
        L, A, world, h, fl = ev[i]
        if L <= k < A:
            q = (k - L) / (A - L)
            e_ = q * q * (3 - 2 * q) + 0.04 * math.sin(PI * q) * (1 - q)  # leaves and arrives softly, with a touch of overshoot
            s = ev[i - 1][2] + (world - ev[i - 1][2]) * e_
            return s - bt, h * (math.sin(PI * q) ** 0.75), fl * math.sin(PI * q)
    planted = [x for x in ev if x[1] <= k]
    return planted[-1][2] - bt, 0.0, 0.0


def gait_pose(G, c, rng_seed=7):
    """Key one looping walk clip (c: name, N, D, heading, yaw, steps, swing, surge, bob, lean). Returns the schedule for inspection.

    The feet follow the schedule exactly (they are planted in the world). Everything else (body height, tilt, squash, tail) is computed for every frame
    first and then smoothed round the loop, because it is driven by how many feet are in the air, which changes in whole steps: keyed straight, the
    ball would jolt every time a foot lifted or landed, and that was the jitter."""
    N, Dd = c["N"], c["D"]
    hd = np.array(c["heading"], float)
    hd = hd / np.linalg.norm(hd)
    yaw = d2r(c["yaw"])
    inplace = bool(c.get("inplace"))
    if inplace:  # the page moves and turns him; the clip is a walk on the spot, facing the camera
        hd, yaw = np.array([0.0, -1.0]), 0.0
    rng = random.Random(c.get("seed", rng_seed))
    b = body_profile(N, Dd, rng, c.get("surge", 0.12))
    sched = plan(N, c.get("steps", 3), c.get("swing", 7), rng, Dd, b)
    assert sched, "no valid foot schedule"
    for rig in (om, ex):
        rig.animation_data_clear()
    for n in BODY_BONES:
        pb = om.pose.bones[n]
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    root, rb, sqt, sqb = (om.pose.bones[x] for x in ("root", "Rotation", "Squash_Top", "Squash_Bottom"))
    T = 2 * PI
    dx, dy = hd
    rest, Minv, home = G["rest"], G["Minv"], G["home"]
    gz = rng.uniform(0, 1)
    st_all, vel, acc, air_n, airL, airR, airF, airB = [], [], [], [], [], [], [], []
    for k in range(N):
        st = {n: foot_state(n, k, sched, b, N, Dd) for n in FOOT_NAMES}
        st_all.append(st)
        vel.append((bint(b, k + 1, N, Dd) - bint(b, k - 1, N, Dd)) / 2 * N / Dd)  # relative speed, mean 1
        acc.append((bint(b, k + 1, N, Dd) - 2 * bint(b, k, N, Dd) + bint(b, k - 1, N, Dd)) * N * N / Dd)
        up = {n: st[n][1] > 0.004 for n in FOOT_NAMES}
        air_n.append(sum(up.values()))
        airL.append(up["FL"] + up["BL"]); airR.append(up["FR"] + up["BR"]); airF.append(up["FL"] + up["FR"]); airB.append(up["BL"] + up["BR"])
    vel, acc = smooth(vel, 2.0), smooth(acc, 3.0)
    airs = {k_: smooth(v_, 3.0) for k_, v_ in dict(n=air_n, L=airL, R=airR, F=airF, B=airB).items()}
    for k in range(N):
        f = k + 1
        u = k / N
        bk = bint(b, k, N, Dd)
        bx, by = (0.0, 0.0) if inplace else (hd[0] * bk, hd[1] * bk)
        st = st_all[k]
        # the body rides a little lower when fewer feet are down; the sway and tilt are slow and small
        bz = FLOOR_Z + c.get("bob", 0.004) * math.sin(T * 4 * u + 0.5) - 0.004 * (airs["n"][k] / 2.0) + 0.002 * (vel[k] - 1)
        root.location = (bx, by, bz)
        root.rotation_euler = (0, 0, yaw)
        for a in range(3):
            key(root, "location", a, f, "root")
        key(root, "rotation_euler", 2, f, "root")
        roll = d2r(1.4) * (airs["L"][k] - airs["R"][k])
        pitch = d2r(8) * (-dy) + d2r(c.get("lean", 0)) + d2r(1.2) * (vel[k] - 1) + d2r(1.0) * (airs["B"][k] - airs["F"][k])
        rb.rotation_euler = (pitch, roll + d2r(10) * dx, -d2r(10) * dx)
        for a in range(3):
            key(rb, "rotation_euler", a, f, "Rotation")
        sqt.location = (0, 0, 0.004 * (airs["n"][k] - 1))
        sqb.location[2] = 0.0
        for a in range(3):
            key(sqt, "location", a, f, "Squash_Top")
        key(sqb, "location", 2, f, "Squash_Bottom")
        for n, (fb, s) in FEET.items():
            rel, lift, fl = st[n]
            pxy = np.array([bx, by]) + Rz(yaw) @ home[n] + hd * rel
            side = np.array([1 if rest[n][0] > 0 else -1, 0])
            pxy = pxy + side * fl
            r_ = np.array([*(Rz(-yaw) @ (pxy - np.array([bx, by]))), lift - bz]) - rest[n]
            cb = om.pose.bones[f"{fb}_Spider_Leg03_ik.{s}"]
            cb.location = tuple(Minv[s] @ r_)
            for a in range(3):
                key(cb, "location", a, f, cb.name)
        # the tail trails behind: a slow lagging sway, a gentle response to the body speeding up and slowing down (it used to whip)
        for j in range(6):
            tb = om.pose.bones[f"Tail0{j + 1}"]
            lag = 0.55 * j
            zz = 0.05 * (1 + 0.2 * j) * math.sin(T * u - lag) + 0.004 * (j + 1) * (-acc[k])
            xx = 0.035 * (1 + 0.2 * j) * math.sin(T * 2 * u - 0.5 * j) + 0.003 * (j + 1) * (vel[k] - 1)
            tb.rotation_euler = (float(np.clip(xx, -0.3, 0.3)), 0, float(np.clip(zz, -0.3, 0.3)))
            key(tb, "rotation_euler", 0, f, tb.name)
            key(tb, "rotation_euler", 2, f, tb.name)
        # eyes look where he is going, with a smooth glance now and then (it used to snap)
        glance = math.sin(T * (u * 2 + gz)) * max(0.0, (math.sin(T * (u + gz)) - 0.7) / 0.3)
        gaze(f, 0.7 * dx + 0.3 * glance, 0.0)
        if not inplace:
            key_camera(G, f, np.array([bx, by, 0.0]), c.get("cdx", 0.0))
    return sched


def gaze(f, gx, gy):
    """Move every eye layer the same way (the layers share one spot; the visible one is chosen by the sliders)."""
    for pbn in ex.pose.bones:
        if pbn.name.endswith(("_Eye.L", "_Eye.R", "_Eye.T")) and "ORG" not in pbn.name and "MCH" not in pbn.name:
            pbn.location = (0.014 * gx, 0.009 * gy, 0)
            key(pbn, "location", 0, f, pbn.name)
            key(pbn, "location", 1, f, pbn.name)
    if len(REC["gaze"]) < f:
        REC["gaze"].append([round(gx, 3), round(gy, 3)])
