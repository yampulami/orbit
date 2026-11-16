"""Which sliders make which expression? At frame 60 the base face has Alpha Slider08 and 09 at y=-0.038 (on) and Slider21 at x=0.06.
So a slider is "on" when its Y location is -0.038. Render every consecutive pair (01+02, 03+04, ...) on its own. Output: <out>/pair_NN.png"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa: F401,F403

a = args()
OUT = a["out"]
os.makedirs(OUT, exist_ok=True)
G = prep()  # keeps the face exactly as it was at frame 60
render_settings(420, 12)
G["cam"].location = np.array([0, -3.0, 1.3])
G["tg"].location = np.array([0, 0, 0.22])
om.pose.bones["root"].location = (0, 0, FLOOR_Z)
sl = {int(b.name[-2:]): b for b in ex.pose.bones if b.name.startswith("Alpha Slider") and not b.name.startswith("ORG")}
print("BASE", {k: [round(v, 3) for v in b.location] for k, b in sl.items() if any(abs(v) > 1e-4 for v in b.location)})
ON = float(a.get("on", "-0.038"))
CAND = {"A_1_3": [1, 3], "B_2_3": [2, 3], "C_4_5": [4, 5], "D_6_7": [6, 7], "E_10_11": [10, 11], "F_12_13": [12, 13], "G_14_15": [14, 15], "H_16_17": [16, 17], "I_18_19": [18, 19], "J_8_5": [8, 5], "K_4_9": [4, 9], "L_10_8": [10, 8], "M_1_2": [1, 2], "N_14_13": [14, 13], "O_12_15": [12, 15], "P_16_9": [16, 9], "Q_8_17": [8, 17], "R_20": [20]}
combos = [("base", [8, 9])] + [("c_" + k, v) for k, v in CAND.items()]
for name, ons in combos:
    for k, b in sl.items():
        if k != 21:
            b.location = (0, 0, 0)
    for k in ons:
        sl[k].location = (0, ON, 0)
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("DONE", name, ons, flush=True)
