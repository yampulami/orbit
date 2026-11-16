"""The clips for the live (three.js) Omega. Every clip is a walk or a gesture performed on the spot, facing the camera: the page decides where he is and
which way he faces, and plays the clip on top. Nothing in a clip wobbles the ball on its own: the ball only moves when the legs or a gesture make it.

Built on acting.py (poses, face, tail) and gait.py (the independent-leg walk). `build(G, name)` keys the clip on the rig and returns what the page needs
to know about it (length, whether it loops, ground speed, and the face over time).
"""
import acting
import gait
from acting import REST_Z, env, osc, pose, tail_wave, feet_rest, apply  # noqa: F401
from common import *  # noqa: F401,F403

HOME = {}  # the resting foot positions, set when the first clip is built


def _air_feet(w, scale, z):
    """Legs drawn in under the body for a jump: `w` is how airborne he is (0 to 1)."""
    feet = {}
    for n in FEET:
        h = HOME[n]
        hw = np.array([h[0] * 1.12, h[1]])
        off = w * (h * scale - hw)
        feet[n] = (float(off[0]), float(off[1]), float(max(z, 0.0) * 0.85 + 0.03) * float(w), 0.0)
    return feet


def _jump(k, N, zp, yp=None, tail=0.1, tail_period=14, scale=0.85, expr=None, peek=0.0, gaze=(0.0, 0.0)):
    z = env(k, zp)
    zs = np.array([env(i, zp) for i in range(N + 1)])
    vz = np.gradient(zs)[k]
    w = ss((z - 0.004) / 0.02)
    yaw = env(k, yp) if yp else 0.0
    st = min(1.6 * abs(vz), 0.1)
    dip = min(z, 0.0)
    crouch = min(1.0, max(0.0, -dip / 0.05))
    return pose(bx=peek, bz=REST_Z + z, yaw=yaw, rb=(d2r(6) * crouch, 0.0, 0.0),
                sqt=(0, 0, float(np.clip(st + 1.3 * dip, -0.09, 0.1))), sqb=float(np.clip(-st - 1.3 * dip, -0.1, 0.09)),
                feet=_air_feet(w, scale, z), tail=tail_wave(k, tail, tail_period), expr=expr or {}, gaze=gaze)


def hop(k, N):
    return _jump(k, N, [(0, 0), (8, -0.06), (14, 0.22), (22, -0.05), (26, 0.012), (31, 0), (N, 0)], tail=0.12, tail_period=18)


def _flip(sign):
    """A somersault: a jump with the ball rolling a full turn (forward for +1, backward for -1) while the legs tuck in."""
    def f(k, N):
        P = _jump(k, N, [(0, 0), (6, -0.05), (9, -0.05), (27, 0.2), (31, 0), (35, -0.04), (39, 0.01), (N, 0)], tail=0.22, tail_period=10, scale=0.8,
                  expr={"happy": env(k, [(0, 0), (8, 1), (34, 1), (N, 0)])})
        roll = env(k, [(0, 0), (9, 0), (28, 1), (N, 1)])
        P["rb"] = (P["rb"][0] + sign * 2 * math.pi * roll, 0.0, 0.0)
        return P
    return f


def spin(k, N):
    return _jump(k, N, [(0, 0), (5, -0.04), (7, -0.04), (14, 0.15), (24, -0.04), (28, 0.012), (33, 0), (N, 0)], [(0, 0), (6, -22), (8, -22), (24, 360), (28, 380), (33, 360), (N, 360)], tail=0.16, tail_period=20, expr={"happy": env(k, [(0, 0), (8, 1), (30, 1), (N, 0)]) * 0.8})


def celebrate(k, N):
    return _jump(k, N, [(0, 0), (5, -0.05), (11, 0.2), (18, -0.05), (22, 0), (25, -0.06), (31, 0.27), (39, -0.06), (43, 0.01), (N, 0)], [(0, 0), (10, -12), (20, 12), (30, -12), (40, 12), (46, 0), (N, 0)],
                 tail=0.3, tail_period=10, expr={"happy": env(k, [(0, 0), (6, 1), (N - 8, 1), (N, 0)])})


def startle(k, N):
    return _jump(k, N, [(0, 0), (3, -0.04), (8, 0.18), (14, 0.02), (18, 0), (N, 0)], [(0, 0), (4, -8), (10, 8), (16, -4), (22, 0), (N, 0)], tail=0.2, tail_period=8, scale=1.18,
                 expr={"squint": env(k, [(0, 0), (3, 1), (16, 1), (N, 0)])})


def tap(k, N):
    pts_z = [(0, 0), (6, 0.08), (10, 0.11), (13, 0.10), (16, 0.11), (20, 0.08), (27, 0), (N, 0)]
    pts_f = [(0, 0), (6, 0.09), (10, 0.0), (13, 0.06), (16, 0.0), (20, 0.09), (27, 0), (N, 0)]
    feet = feet_rest()
    feet["FR"] = (0.0, -env(k, pts_f), env(k, pts_z), 0.0)
    nod = d2r(10) * math.sin(math.pi * min(k / N * 1.3, 1))
    return pose(bz=REST_Z - 0.012 * math.sin(math.pi * min(k / N * 1.3, 1)), rb=(nod, 0, 0), feet=feet, tail=tail_wave(k, 0.1, 12), gaze=(0.0, -0.5))


def _peek(side):
    def f(k, N):
        e = env(k, [(0, 0), (10, 1), (28, 1), (N, 0)])
        return pose(bx=side * 0.22 * e, yaw=side * 20 * e, rb=(0, 0, d2r(-14) * side * e), tail=tail_wave(k, 0.05, 30), gaze=(side * 0.9 * e, 0.0))
    return f


def idle(k, N):
    """Standing, breathing, the tail drifting, the eyes now and then moving to look at something. Loops."""
    u = k / N
    look = env(k, [(0, 0), (20, 0), (30, 0.8), (46, 0.8), (56, -0.6), (70, -0.6), (82, 0), (N, 0)])
    return pose(bz=REST_Z + 0.0025 * math.sin(2 * PI * u), sqt=(0, 0, 0.003 * math.sin(2 * PI * u)), tail=tail_wave(k, 0.05, N, lag=0.7), gaze=(0.55 * look, 0.08 * math.sin(2 * PI * u)))


PI = math.pi


def read(k, N):
    P = acting.read_E(k, N)
    P["by"], P["bx"], P["yaw"] = -P["bx"], 0.0, 0.0
    return P


def think(k, N):
    P = acting.think(k, N)
    P["yaw"] = 0.0
    return P


# name: (frames, loops, pose function). The walks are made by gait.py.
CLIPS = {
    "idle": (96, True, idle), "hop": (36, False, hop), "spin": (40, False, spin), "celebrate": (48, False, celebrate), "startle": (30, False, startle), "tap": (36, False, tap),
    "peek_l": (40, False, _peek(-1)), "peek_r": (40, False, _peek(1)),
    "wave": (56, False, acting.wave), "nod": (34, False, acting.nod), "read": (48, True, read), "think": (64, True, think), "perk": (40, False, acting.perk),
    "dizzy": (56, False, acting.dizzy), "stomp": (36, False, acting.stomp), "settle": (36, False, acting.settle), "rest": (72, True, acting.rest),
    "flip": (40, False, _flip(1)), "backflip": (40, False, _flip(-1)), "shake": (36, False, acting.shake),
    "blink": (14, False, acting.blink), "smile": (52, False, acting.smile), "wiggle": (44, False, acting.wiggle), "bow": (44, False, acting.bow), "yawn": (64, False, acting.yawn),
    "lowbat": (72, False, acting.lowbat), "wince": (36, False, acting.wince), "shrug": (40, False, acting.shrug), "look_around": (72, False, acting.look_around),
}
WALKS = {
    "walk": dict(N=48, D=0.56, steps=2, swing=6, surge=0.12, bob=0.006, seed=21),
    "skitter": dict(N=32, D=0.64, steps=2, swing=4, surge=0.16, bob=0.009, lean=5, seed=33),
}


def names():
    return list(CLIPS) + list(WALKS)


def build(G, name):
    """Key one clip on the rig. Returns {frames, loop, speed (ground units a second, for the walks), expr, gaze}."""
    if not HOME:
        HOME.update(G["home"])
    for rig in (om, ex):
        rig.animation_data_clear()
    for n in BODY_BONES:
        pb = om.pose.bones[n]
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    REC["expr"].clear(); REC["gaze"].clear()
    if name in WALKS:
        c = dict(WALKS[name], name=name, heading=[0, -1], yaw=0, inplace=True)
        gait.gait_pose(G, c)
        set_linear()
        for rig in (om, ex):
            if rig.animation_data and rig.animation_data.action:
                for l in rig.animation_data.action.layers:
                    for stp in l.strips:
                        for cb_ in stp.channelbags:
                            for fc in cb_.fcurves:
                                fc.modifiers.new('CYCLES')
        N = c["N"]
        meta = {"frames": N, "loop": True, "speed": round(c["D"] * 24 / N, 4)}
    else:
        N, loop, fn = CLIPS[name]
        for k in range(N):
            apply(G, k + 1, fn(k, N), None)
        set_linear()
        meta = {"frames": N, "loop": loop, "speed": 0}
    meta["expr"] = [dict(e) for e in REC["expr"]]
    meta["gaze"] = [list(g) for g in REC["gaze"]]
    return meta
