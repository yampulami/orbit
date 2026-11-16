"""Omega's acting clips: short, one-shot performances (wave, read, nod, think, perk, dizzy, stomp, settle, rest, low battery, wince, shrug, look around).

Each clip is a function of the frame that returns a pose: body position and tilt, where each of the four feet is (an offset from its resting spot, how high
it is lifted), the tail, which eyes are showing, and where they look. Clips start and end in his standing rest pose (the same one the idle clip uses) so
that they join smoothly to whatever comes before and after; `settle` ends sitting and `rest` is the sitting pose, so they chain.

The face is a set of sliders: each Alpha Slider at Y = -0.038 shows one eye layer. Pairs make an expression (found by rendering each slider alone).
"""
from common import *  # noqa: F401,F403
import gait

PI = math.pi
EXPR = {"neutral": [8, 9], "dots": [1, 3], "happy": [10, 11], "wide": [4, 5], "sleepy": [6, 7], "determined": [12, 13], "flat": [14, 15], "dizzy": [16, 17], "squint": [18, 19], "battery": [20]}
ON = -0.038
REST_Z = FLOOR_Z - 0.045  # how low he stands when idle


def env(k, pts):
    """Smooth envelope through (frame, value) points: eases between them."""
    if k <= pts[0][0]:
        return pts[0][1]
    for (f0, v0), (f1, v1) in zip(pts, pts[1:]):
        if f0 <= k <= f1:
            return v0 + (v1 - v0) * ss((k - f0) / max(f1 - f0, 1e-6))
    return pts[-1][1]


def osc(k, period, phase=0.0):
    return math.sin(2 * PI * (k / period) + phase)


def pose(**kw):
    p = dict(bx=0.0, by=0.0, bz=REST_Z, yaw=0.0, rb=(0.0, 0.0, 0.0), sqt=(0.0, 0.0, 0.0), sqb=0.0,
             feet={n: (0.0, 0.0, 0.0, 0.0) for n in FEET}, tail=[(0.0, 0.0)] * 6, expr={}, gaze=(0.0, 0.0))
    p.update(kw)
    return p


def tail_wave(k, amp, period, lag=0.55, droop=0.0, curl=0.0):
    amp = amp * 0.6  # the tail trails rather than flails: calmer than the first pass
    return [(float(np.clip(0.05 * (1 + 0.2 * j) * osc(k, period * 2, -0.5 * j) + 0.0, -0.45, 0.45)),
             float(np.clip(amp * (1 + 0.35 * j) * osc(k, period, -lag * j) + droop * (j + 1) / 6 + curl * (j / 5.0), -0.5, 0.5))) for j in range(6)]


def feet_rest():
    return {n: (0.0, 0.0, 0.0, 0.0) for n in FEET}


def apply(G, f, P, cdx=0.0):
    root, rb, sqt, sqb = (om.pose.bones[x] for x in ("root", "Rotation", "Squash_Top", "Squash_Bottom"))
    root.location = (P["bx"], P["by"], P["bz"])
    root.rotation_euler = (0, 0, d2r(P["yaw"]))
    for a in range(3):
        key(root, "location", a, f, "root")
    key(root, "rotation_euler", 2, f, "root")
    rb.rotation_euler = P["rb"]
    for a in range(3):
        key(rb, "rotation_euler", a, f, "Rotation")
    sqt.location = P["sqt"]
    sqb.location[2] = P["sqb"]
    for a in range(3):
        key(sqt, "location", a, f, "Squash_Top")
    key(sqb, "location", 2, f, "Squash_Bottom")
    rest, Minv, home = G["rest"], G["Minv"], G["home"]
    for n, (fb, s) in FEET.items():
        ox, oy, lz, fl = P["feet"][n]
        hw = np.array([home[n][0] * 1.12, home[n][1]])
        xy = hw + np.array([ox, oy]) + np.array([1 if rest[n][0] > 0 else -1, 0]) * fl
        r_ = np.array([xy[0], xy[1], lz - P["bz"]]) - rest[n]
        cb = om.pose.bones[f"{fb}_Spider_Leg03_ik.{s}"]
        cb.location = tuple(Minv[s] @ r_)
        for a in range(3):
            key(cb, "location", a, f, cb.name)
    for j in range(6):
        tb = om.pose.bones[f"Tail0{j + 1}"]
        tb.rotation_euler = (P["tail"][j][0], 0, P["tail"][j][1])
        key(tb, "rotation_euler", 0, f, tb.name)
        key(tb, "rotation_euler", 2, f, tb.name)
    # the face: each expression's sliders fade with its weight, neutral takes up the rest
    w = dict(P["expr"])
    w["neutral"] = max(0.0, 1.0 - sum(v for k_, v in w.items() if k_ != "neutral"))
    on = {i: 0.0 for i in range(1, 21)}
    for name, wt in w.items():
        for i in EXPR[name]:
            on[i] = max(on[i], min(1.0, wt))
    for pb in ex.pose.bones:
        if pb.name.startswith("Alpha Slider") and not pb.name.startswith("ORG"):
            i = int(pb.name[-2:])
            if i <= 20:
                pb.location = (0, ON * on[i], 0)
                key(pb, "location", 1, f, pb.name)
    if len(REC["expr"]) < f:
        REC["expr"].append({k_: round(v, 3) for k_, v in w.items() if v > 0.01})
    gaze_(f, *P["gaze"])
    if cdx is not None:
        key_camera(G, f, np.array([P["bx"], P["by"], 0.0]), cdx)


def gaze_(f, gx, gy):
    gait.gaze(f, gx, gy)


def build(G, c):
    N, fn = c["N"], CLIPS[c["name"]]
    for rig in (om, ex):
        rig.animation_data_clear()
    for n in BODY_BONES:
        pb = om.pose.bones[n]
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    for k in range(N):
        apply(G, k + 1, fn(k, N), c.get("cdx", 0.0))
    set_linear()


# ------------------------------------------------------------------------------------------------ the clips

def wave(k, N):
    # A hello with one raised leg: it lifts high and out, then the tip swings side to side the way a hand does: slower at each end, quick through the
    # middle, dipping a little at the middle of the swing (an arc, not a straight sweep), with a lag in the depth so the tip traces a loose loop.
    up = env(k, [(0, 0), (12, 1), (46, 1), (N, 0)])
    amp = env(k, [(0, 0), (14, 0), (22, 1), (40, 1), (49, 0)])
    th = 2 * PI * (k - 14) / 18.0
    sw = math.sin(th) * amp                    # the swing, -1..1
    arc = (1 - math.cos(2 * th)) / 2 * amp     # high at both ends of the swing, low in the middle
    feet = feet_rest()
    feet["FR"] = (0.11 * up + 0.12 * sw, -0.07 * up + 0.025 * math.cos(th) * amp, 0.34 * up + 0.045 * arc, 0.04 * up + 0.03 * sw)
    feet["FL"] = (-0.02 * up, 0.0, 0.0, 0.0)
    return pose(bz=REST_Z + 0.014 * up, rb=(-0.07 * up, 0.0, -0.05 * sw), feet=feet,
                tail=tail_wave(k, 0.20 * env(k, [(0, 0.3), (12, 1), (46, 1), (N, 0.3)]), 14), expr={"happy": env(k, [(0, 0), (5, 1), (48, 1), (N, 0)])}, gaze=(0.25 * up, 0.3 * up))


def blink(k, N):
    """A quick blink: the eyes shut to lines and open again, with the smallest dip of the body."""
    sh = env(k, [(0, 0), (3, 1), (6, 1), (N, 0)])
    return pose(bz=REST_Z - 0.004 * sh, tail=tail_wave(k, 0.04, 30), expr={"squint": sh}, gaze=(0, 0))


def smile(k, N):
    """A pleased little bounce with a happy face, looking at whoever is there."""
    on = env(k, [(0, 0), (6, 1), (N - 8, 1), (N, 0)])
    b = max(0.0, osc(k - 8, 20)) * env(k, [(0, 0), (8, 1), (N - 10, 1), (N, 0)])
    return pose(bz=REST_Z + 0.02 * b + 0.006 * on, rb=(-0.04 * on, 0.0, 0.05 * osc(k, 40) * on), sqt=(0, 0, 0.01 * b), tail=tail_wave(k, 0.2 * on + 0.05, 12),
                expr={"happy": on}, gaze=(0.0, 0.25 * on))


def wiggle(k, N):
    """A happy shuffle: the body sways side to side while the feet take turns lifting, and the tail goes."""
    on = env(k, [(0, 0), (6, 1), (N - 8, 1), (N, 0)])
    s = osc(k, 20)
    feet = feet_rest()
    a, b = max(0.0, s), max(0.0, -s)
    feet["FR"] = (0.0, 0.0, 0.05 * a * on, 0.0)
    feet["BL"] = (0.0, 0.0, 0.05 * a * on, 0.0)
    feet["FL"] = (0.0, 0.0, 0.05 * b * on, 0.0)
    feet["BR"] = (0.0, 0.0, 0.05 * b * on, 0.0)
    return pose(bx=0.02 * s * on, bz=REST_Z + 0.008 * on + 0.006 * abs(s) * on, yaw=10 * s * on, rb=(0.0, 0.0, d2r(8) * s * on), feet=feet,
                tail=tail_wave(k, 0.28 * on, 10), expr={"happy": on * 0.9}, gaze=(0.3 * s * on, 0.1))


def shake(k, N):
    """Shaking the head 'no': the whole body turns a little each way, quickly, with the eyes going with it."""
    on = env(k, [(0, 0), (4, 1), (N - 6, 1), (N, 0)])
    s = osc(k, 12)
    return pose(bz=REST_Z - 0.004 * on, yaw=22 * s * on, tail=tail_wave(k, 0.12, 10), expr={"flat": 0.85 * on}, gaze=(0.7 * s * on, 0.0))


def bow(k, N):
    """A small bow: down and forward, a beat, then back up."""
    d = env(k, [(0, 0), (12, 1), (24, 1), (N, 0)])
    return pose(bz=REST_Z - 0.03 * d, rb=(0.42 * d, 0.0, 0.0), sqt=(0, 0, 0.01 * d), tail=tail_wave(k, 0.1, 18, droop=0.2 * d),
                expr={"dots": env(k, [(0, 0), (8, 1), (28, 1), (N, 0)])}, gaze=(0, -0.5 * d))


def yawn(k, N):
    """A sleepy stretch: leans back and rises, sags, then shakes it off."""
    up = env(k, [(0, 0), (14, 1), (30, 1), (42, 0), (N, 0)])
    sag = env(k, [(0, 0), (30, 0), (42, 1), (52, 0.4), (N, 0)])
    return pose(bz=REST_Z + 0.03 * up - 0.02 * sag, rb=(-0.22 * up + 0.15 * sag, 0.0, 0.0), sqt=(0, 0, 0.02 * up), tail=tail_wave(k, 0.06, 40, droop=0.25 * sag),
                expr={"sleepy": env(k, [(0, 0), (10, 1), (46, 1), (N, 0)])}, gaze=(0, 0.2 * up))


def nod(k, N):
    d = osc(k - 4, 14) * env(k, [(0, 0), (4, 1), (22, 1), (N, 0)])
    dip = max(0.0, -d) if False else (1 - math.cos(2 * PI * (k - 4) / 14)) / 2 * env(k, [(0, 0), (4, 1), (24, 1), (N, 0)])
    return pose(bz=REST_Z - 0.03 * dip, rb=(0.17 * dip, 0, 0), sqt=(0, 0, 0.012 * (dip - 0.5)), tail=tail_wave(k, 0.12, 16),
                expr={"dots": env(k, [(0, 0), (4, 1), (26, 1), (N, 0)])}, gaze=(0, -0.4 * dip))


def read_E(k, N):
    """Facing east, leaning in to read something: forward and down, eyes sweeping along a line. Loops cleanly."""
    lean = env(k, [(0, 0.55), (10, 1), (38, 1), (N, 0.55)])
    sweep = osc(k, N / 2, 0.4)
    feet = feet_rest()
    feet["FR"] = (0.0, -0.035 * lean, 0.0, 0.0)
    feet["FL"] = (0.0, -0.025 * lean, 0.0, 0.0)
    return pose(yaw=65, bx=0.04 * lean, bz=REST_Z - 0.012 * lean, rb=(0.2 * lean, 0, 0.0), feet=feet, tail=tail_wave(k, 0.07, N / 2, droop=-0.1),
                expr={"wide": 0.0}, gaze=(0.9 * sweep, -0.5 * lean))


def think(k, N):
    tap = max(0.0, osc(k, 16)) * env(k, [(0, 0), (8, 1), (N - 8, 1), (N, 0)])
    hold = env(k, [(0, 0), (10, 1), (N - 10, 1), (N, 0)])
    feet = feet_rest()
    feet["FL"] = (0.0, -0.02 * hold, 0.07 * tap, 0.0)
    return pose(yaw=22 * hold, bz=REST_Z + 0.004 * hold, rb=(0.03 * hold, 0.1 * hold, -0.08 * hold), feet=feet, tail=tail_wave(k, 0.05, 40, curl=0.35 * hold),
                expr={"flat": env(k, [(0, 0), (8, 0.9), (N - 8, 0.9), (N, 0)]), "squint": 0.0}, gaze=(-0.7 * hold, 0.9 * hold))


def perk(k, N):
    up = env(k, [(0, 0), (6, 1), (30, 0.6), (N, 0)])
    hop = max(0.0, osc(k - 6, 18)) * env(k, [(0, 0), (6, 0), (8, 1), (30, 1), (34, 0)])
    feet = feet_rest()
    for n in FEET:
        feet[n] = (0.0, 0.0, 0.05 * hop + 0.0, 0.02 * up)
    return pose(bz=REST_Z + 0.03 * up + 0.05 * hop, rb=(-0.05 * up, 0, 0), sqt=(0, 0, 0.012 * hop), feet=feet, tail=tail_wave(k, 0.3 * up + 0.05, 10),
                expr={"happy": env(k, [(0, 0), (4, 1), (N - 8, 1), (N, 0)])}, gaze=(0, 0.3 * up))


def dizzy(k, N):
    a = env(k, [(0, 0), (6, 1), (40, 0.8), (N, 0)])
    feet = feet_rest()
    for i, n in enumerate(FEET):
        feet[n] = (0.03 * a * (1 if n in ("FR", "BR") else -1) * 1.0, 0.0, max(0.0, osc(k, 20, i * 1.6)) * 0.035 * a, 0.03 * a)
    return pose(yaw=11 * a * osc(k, 24), bz=REST_Z - 0.018 * a, rb=(0.0, 0.14 * a * osc(k, 24, 1.0), 0.10 * a * osc(k, 24, 2.0)), feet=feet,
                tail=tail_wave(k, 0.2 * a, 24, droop=0.1), expr={"dizzy": env(k, [(0, 0), (4, 1), (N - 8, 1), (N, 0)])})


def stomp(k, N):
    lift = env(k, [(0, 0), (8, 1), (13, 1), (15, 0), (N, 0)])
    hit = env(k, [(14, 0), (15, 1), (22, 0), (N, 0)])
    feet = feet_rest()
    feet["FR"] = (0.04 * lift, -0.07 * lift, 0.28 * lift, 0.0)
    return pose(bz=REST_Z + 0.014 * lift - 0.034 * hit, rb=(0.06 * hit - 0.05 * lift, 0, 0), sqt=(0, 0, -0.03 * hit), sqb=0.02 * hit, feet=feet,
                tail=tail_wave(k, 0.1 + 0.2 * hit, 12), expr={"determined": env(k, [(0, 0), (6, 1), (26, 1), (N, 0)])}, gaze=(0, -0.6))


def settle(k, N):
    """Lowers himself into sitting, legs folding out. Ends exactly in the `rest` pose."""
    d = env(k, [(0, 0), (N - 4, 1), (N, 1)])
    return rest_pose(d, k, 0.0)


def rest_pose(d, k, breathe):
    feet = feet_rest()
    for n in FEET:
        feet[n] = (0.045 * d * (1 if n in ("FR", "BR") else -1), 0.0, 0.0, 0.035 * d)
    return pose(bz=REST_Z - 0.052 * d + 0.0035 * breathe * d, rb=(0.05 * d, 0, 0), sqt=(0, 0, -0.01 * d), feet=feet, tail=tail_wave(k, 0.03 * d + 0.0, 40, droop=-0.2 * d),
                expr={"dots": 0.6 * d}, gaze=(0, -0.15 * d))


def rest(k, N):
    return rest_pose(1.0, k, osc(k, N))


def lowbat(k, N):
    sag = env(k, [(0, 0), (14, 1), (58, 1), (N, 0)])
    shiver = osc(k, 5) * env(k, [(14, 0), (22, 1), (50, 1), (58, 0)])
    feet = feet_rest()
    for n in FEET:
        feet[n] = (0.02 * sag * (1 if n in ("FR", "BR") else -1), 0.0, 0.0, 0.025 * sag)
    return pose(bz=REST_Z - 0.05 * sag + 0.004 * shiver, rb=(0.12 * sag, 0.02 * shiver, 0.0), feet=feet, tail=tail_wave(k, 0.02 + 0.015 * shiver, 6, droop=-0.35 * sag),
                expr={"battery": env(k, [(0, 0), (10, 1), (60, 1), (N, 0)]) * (0.55 + 0.45 * (1 if (k // 6) % 2 == 0 else 0.35))}, gaze=(0, 0))


def wince(k, N):
    r = env(k, [(0, 0), (4, 1), (22, 1), (N, 0)])
    feet = feet_rest()
    for n in FEET:
        feet[n] = (-0.03 * r * (1 if n in ("FR", "BR") else -1), 0.02 * r, 0.0, 0.0)
    return pose(yaw=-9 * r, bz=REST_Z - 0.016 * r, rb=(-0.1 * r, 0, 0.05 * r), feet=feet, tail=tail_wave(k, 0.04, 8, droop=0.4 * r),
                expr={"squint": env(k, [(0, 0), (3, 1), (24, 1), (N, 0)])}, gaze=(0, 0))


def shrug(k, N):
    s = env(k, [(0, 0), (8, 1), (26, 1), (N, 0)])
    feet = feet_rest()
    for n in FEET:
        feet[n] = (0.03 * s * (1 if n in ("FR", "BR") else -1), 0.0, 0.03 * s, 0.03 * s)
    return pose(bz=REST_Z + 0.03 * s, rb=(0, 0.1 * s * osc(k, 20), 0), sqt=(0, 0, 0.012 * s), feet=feet, tail=tail_wave(k, 0.08 * s, 18),
                expr={"flat": env(k, [(0, 0), (6, 1), (30, 1), (N, 0)])}, gaze=(0.3 * osc(k, 40), 0.2 * s))


def look_around(k, N):
    turn = env(k, [(0, 0), (12, 1), (28, 1), (40, -1), (58, -1), (N, 0)])
    glance = env(k, [(0, 0), (10, 0.9), (30, 0.9), (38, -0.9), (60, -0.9), (N, 0)])
    feet = feet_rest()
    feet["BL"] = (0.0, 0.0, 0.02 * max(0.0, osc(k - 30, 40)), 0.0)
    return pose(bz=REST_Z + 0.004 * osc(k, N), yaw=14 * turn, rb=(0.0, 0.0, 0.14 * turn), feet=feet, tail=tail_wave(k, 0.07, 36), gaze=(0.9 * glance, 0.1))


# name: (frames, function). Ends of a clip match the rest pose so clips join cleanly, except where noted (settle ends sitting; rest is sitting).
CLIPS = {"wave": wave, "nod": nod, "read_E": read_E, "think": think, "perk": perk, "dizzy": dizzy, "stomp": stomp, "settle": settle, "rest": rest, "lowbat": lowbat,
         "wince": wince, "shrug": shrug, "look_around": look_around}
FRAMES = {"wave": 56, "nod": 34, "read_E": 48, "think": 64, "perk": 40, "dizzy": 56, "stomp": 36, "settle": 36, "rest": 72, "lowbat": 72, "wince": 36, "shrug": 40, "look_around": 72}
