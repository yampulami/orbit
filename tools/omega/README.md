# Omega, live

Omega (the orange spider-bot, from the free Agora "Omega" training-bot rig; class project, non-commercial) runs live in the setup pages: the real 3D model,
drawn with three.js in a transparent canvas over the page (`web/src/lib/omega/`). These scripts make what the page loads, from `Omega_Orbit_Onboarding.blend`.

(An earlier version drew him from rendered sprite pictures. They looked soft and a bit pasted on, turned between eight fixed views, and took hundreds of
megabytes of memory once decoded. Live, he turns smoothly, his clips blend as poses, the light and shadow are real, and the whole thing is under 2 MB.)

## What the page loads (`web/public/omega/`)

| File | What it is |
|---|---|
| `omega.glb` | The meshes, the skeleton (deforming bones only) and every clip as an animation. No materials: the page builds them. Compressed with meshopt. |
| `omega_clips.json` | Per clip: frames, whether it loops, ground speed (walks), and the face over time (which eye layers show, where they look). |
| `omega_dif.webp`, `omega_emi.webp`, `omega_orm.webp` | One 2048x1024 atlas of the shell, doors, legs and tail: colour, glow, and opacity+roughness. |
| `omega_eyes1001.webp`, `omega_eyes1003.webp` | The glowing eye shapes (colour = glow, alpha = shape). |

## Making them

```
# 1. the model and every clip (walks are on the spot, facing the camera; the page moves and turns him)
blender -b Omega_Orbit_Onboarding.blend --python tools/omega/export_live.py -- out=DIR defbones=1

# 2. compress it (resample the animation, then meshopt); the page's loader reads meshopt
npx @gltf-transform/cli resample DIR/omega.glb DIR/r.glb
npx @gltf-transform/cli meshopt DIR/r.glb web/public/omega/omega.glb --level medium
cp DIR/omega_clips.json web/public/omega/

# 3. the textures (they are packed in the .blend as seven UDIM tiles)
blender -b Omega_Orbit_Onboarding.blend --python tools/omega/make_textures.py -- out=TILES
python tools/omega/pack_textures.py --tiles TILES --out web/public/omega
```

## The files

| File | What it does |
|---|---|
| `common.py` | The scene set up the way the page wants it, and rig helpers. |
| `gait.py` | The walk: every foot has its own timing, length and height, the front foot of a pair always leads so the legs never cross, and the body is smoothed so it never jolts. |
| `acting.py` | Gestures (wave, nod, read, think, perk, dizzy, stomp, settle, rest, low battery, wince, shrug, look around) and the face. |
| `live.py` | The clip list for the live version, including hop, spin, celebrate, startle, tap and the peeks, and the idle. Nothing wobbles the ball on its own. |
| `export_live.py` | Builds every clip, remaps the texture coordinates to the atlas, and writes the glb and the clip json. |
| `make_textures.py`, `pack_textures.py` | Pull the textures out of the .blend and pack them for the web. |
| `probe_expr.py` | Renders each face slider, to see what it does. |

## The card pictures (setup, "A little about your life on campus")

`cards.py` poses the real model with simple props (a residence hall and a backpack, a small open car, a house and moving boxes, a map and a pin) and renders each with a transparent background and a soft contact shadow. `pack_cards.py` gives them one shared crop (so Omega is the same size in every card) and writes transparent WebP into `web/public/cards/`.

```
blender -b C:/Users/yamii/Desktop/Omega_Orbit_Onboarding.blend --python tools/omega/cards.py -- out=DIR size=1100 samples=96
python tools/omega/pack_cards.py --src DIR --out web/public/cards
```

Add a scene by writing a `scene_xxx()` beside the others (props from `box()` / `prim()`, a pose from `acting.py`, `camera(...)`, `render("name")`) and listing it in `SCENES`. `probe_cards.py` prints where the ball and the ground are.

## Things that bit us

- Use `C:\Users\yamii\Desktop\Omega_Orbit_Onboarding.blend`. The copy under OneDrive has a different rig and exports without the tail.
- The doors that close the shell hang off `ORG-` bones, which the deform-bones-only export drops. `export_live.py` moves them onto `DEF-Ball` so the head and sides are not open holes.
- Setup now has him tiny on the progress bar, doing: wave (first step only), hop, smile, blink, wiggle, nod, bow, perk, look_around, yawn, shrug, spin, tap, stomp, startle, celebrate (last step).

## The face

An expression is a pair of eye layers, shown or hidden: neutral (Eye_L, Eye_R), dots (Satisfied), happy, wide (Sad), sleepy (Exhausted), determined (Angry),
flat (Unphased), dizzy (KO, the X eyes), squint (the >< eyes) and low battery. Each clip says which are showing at each frame.

## Speeds

Walk is 0.28 units a second and skitter 0.48 (`speed` in the clip json). The page blends idle, walk and skitter by how fast he is going and plays the walks
at the rate that matches the ground, so his feet do not slide.
