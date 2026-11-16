import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/** Omega, the model, ready to put in a scene: loaded, given his materials, and with his face switchable.
 *
 *  The file (omega.glb) has the meshes, the skeleton and every clip as an animation, but no materials: Blender's recolouring and layered eye decals do not
 *  survive glTF, so they are rebuilt here from a few small textures. The shell is the original diffuse map pushed through the orange colour ramp the sprites
 *  used; the eyes are glowing shapes on flat pieces which are shown or hidden to change his expression. */
export type Expr = "neutral" | "dots" | "happy" | "wide" | "sleepy" | "determined" | "flat" | "dizzy" | "squint" | "battery";
const EXPR_MESHES: Record<Expr, string[]> = {
  neutral: ["Eye_L_geo", "Eye_R_geo"],
  dots: ["EXP_Satisfied_L_geo", "EXP_Satisfied_R_geo"],
  happy: ["EXP_Happy_L_geo", "EXP_Happy_R_geo"],
  wide: ["EXP_Sad_L_geo", "EXP_Sad_R_geo"],
  sleepy: ["EXP_Exhausted_L_geo", "EXP_Exhausted_R_geo", "EXP_Exhausted_Add_1_L_geo", "EXP_Exhausted_Add_1_R_geo", "EXP_Exhausted_Add_2_L_geo", "EXP_Exhausted_Add_2_R_geo"],
  determined: ["EXP_Angry_L_geo", "EXP_Angry_R_geo"],
  flat: ["EXP_Unphased_L_geo", "EXP_Unphased_R_geo"],
  dizzy: ["EXP_KO_L_geo", "EXP_KO_R_geo"],
  squint: ["EXP_Poin_L_geo", "EXP_Poin_R_geo"],
  battery: ["EXP_LowBatery_geo"],
};
export const EXPRESSIONS = Object.keys(EXPR_MESHES) as Expr[];

// Blender's colour ramp on the diffuse map's brightness (linear colours): dark red-black, deep orange, orange, bright orange
const RAMP = [
  [0.0, 0.001, 0.0, 0.0], [0.22, 0.339, 0.021, 0.0], [0.55, 0.701, 0.062, 0.001], [1.0, 0.932, 0.16, 0.008],
];
const v3 = (i: number) => `vec3(${RAMP[i].slice(1).join(",")})`;
const RAMP_GLSL = `
vec3 omegaRamp(float t) {
  if (t < ${RAMP[1][0]}) return mix(${v3(0)}, ${v3(1)}, t / ${RAMP[1][0]});
  if (t < ${RAMP[2][0]}) return mix(${v3(1)}, ${v3(2)}, (t - ${RAMP[1][0]}) / ${(RAMP[2][0] - RAMP[1][0]).toFixed(3)});
  return mix(${v3(2)}, ${v3(3)}, clamp((t - ${RAMP[2][0]}) / ${(RAMP[3][0] - RAMP[2][0]).toFixed(3)}, 0.0, 1.0));
}`;

export type OmegaModel = {
  root: THREE.Group;
  clips: THREE.AnimationClip[];
  /** Show these expressions (name to how much, 0 to 1). Neutral takes whatever is left. */
  setExpression(weights: Partial<Record<Expr, number>>): void;
  /** Move the eyes a little: x and y from -1 to 1. */
  setGaze(x: number, y: number): void;
  /** Turn the whole ball this colour, by `p` (0 to 1): the shell, the dark face plate and the eyes (which go to `eye`). Used when he becomes the logo's ball. */
  setTint(body: string, eye: string, p: number): void;
  setDark(dark: boolean): void;
  dispose(): void;
};

const loader = (base: string) => new THREE.TextureLoader().setPath(base);

export async function loadOmega(base: string, renderer: THREE.WebGLRenderer): Promise<{ model: OmegaModel; env: THREE.Texture }> {
  const tl = loader(base);
  const tex = (name: string, srgb: boolean) => new Promise<THREE.Texture>((res, rej) => tl.load(name, (t) => {
    t.flipY = false; // the model's coordinates follow glTF, where the picture starts at its top
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    res(t);
  }, undefined, rej));
  const [gltf, dif, emi, orm, eyes1001, eyes1003] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(base + "omega.glb"),
    tex("omega_dif.webp", true), tex("omega_emi.webp", true), tex("omega_orm.webp", false), tex("omega_eyes1001.webp", true), tex("omega_eyes1003.webp", true),
  ]);

  const shell = new THREE.MeshPhysicalMaterial({ map: dif, emissiveMap: emi, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1, roughness: 0.92, metalness: 0, // matte, like paper or painted plastic: no hot highlights, so he sits with the flat UI
    alphaMap: orm, alphaTest: 0.5, side: THREE.DoubleSide, clearcoat: 0, specularIntensity: 0.18, envMapIntensity: 0.8 });
  shell.alphaToCoverage = true;
  let baseEmissive = 1;
  const tintColor = { value: new THREE.Color(1, 1, 1) }, tintMix = { value: 0 };
  shell.onBeforeCompile = (sh) => {
    sh.uniforms.uTint = tintColor; sh.uniforms.uTintMix = tintMix;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform vec3 uTint;\nuniform float uTintMix;\n${RAMP_GLSL}`)
      .replace("#include <map_fragment>", `vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        float omegaLum = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb *= omegaRamp(omegaLum);
        diffuseColor.rgb = mix(diffuseColor.rgb, uTint, uTintMix);`)
      .replace("#include <alphamap_fragment>", "#ifdef USE_ALPHAMAP\n diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).r;\n#endif");
  };
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, roughness: 0.5, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.6, transparent: true, opacity: 0.62, depthWrite: false, envMapIntensity: 0.9 });
  const glowFor = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
  const eyeMats = { 1001: glowFor(eyes1001), 1003: glowFor(eyes1003) };

  // The eyes ride on the head bone, so "right" and "up" on screen are some other directions in their own space. Worked out once, in the rest pose.
  gltf.scene.updateMatrixWorld(true);
  const eyeAxes = new Map<string, { x: THREE.Vector3; y: THREE.Vector3 }>();
  const axesIn = (m: THREE.Object3D) => {
    const q = new THREE.Quaternion(), sc = new THREE.Vector3();
    (m.parent ?? m).getWorldQuaternion(q); (m.parent ?? m).getWorldScale(sc);
    q.invert();
    return { x: new THREE.Vector3(1, 0, 0).applyQuaternion(q).divide(sc), y: new THREE.Vector3(0, 1, 0).applyQuaternion(q).divide(sc) };
  };
  const exprMeshes = new Map<string, THREE.Mesh>();
  const eyeBase = new Map<string, THREE.Vector3>();
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.frustumCulled = false; // skinned parts move well outside their rest-pose bounds
    if (m.name.startsWith("EXP_") || /^Eye_[LRT]_geo$/.test(m.name)) {
      const mat = (m.name.startsWith("EXP_") ? eyeMats[1003] : eyeMats[1001]).clone();
      m.material = mat; m.renderOrder = 5; m.castShadow = false;
      m.position.z += 0.022; // out onto the face plate (they come out of Blender level with it, so the plate would hide them)
      exprMeshes.set(m.name, m); eyeBase.set(m.name, m.position.clone());
      eyeAxes.set(m.name, axesIn(m));
    } else if (/glass/i.test(m.name)) { m.material = glass; m.renderOrder = 6; m.castShadow = false; }
    else m.material = shell;
  });

  const setExpression: OmegaModel["setExpression"] = (w) => {
    const sum = EXPRESSIONS.reduce((s, k) => s + (k === "neutral" ? 0 : w[k] ?? 0), 0);
    const all: Partial<Record<Expr, number>> = { ...w, neutral: Math.max(0, 1 - sum) };
    exprMeshes.forEach((m) => { (m.material as THREE.MeshBasicMaterial).opacity = 0; m.visible = false; });
    for (const k of EXPRESSIONS) {
      const v = Math.min(1, all[k] ?? 0);
      if (v < 0.02) continue;
      for (const n of EXPR_MESHES[k]) { const m = exprMeshes.get(n); if (m) { m.visible = true; (m.material as THREE.MeshBasicMaterial).opacity = v; } }
    }
  };
  setExpression({});
  const setGaze = (x: number, y: number) => exprMeshes.forEach((m, n) => { const b = eyeBase.get(n), ax = eyeAxes.get(n); if (b && ax) m.position.copy(b).addScaledVector(ax.x, x * 0.012).addScaledVector(ax.y, y * 0.008); });

  if (renderer.getContext().isContextLost()) throw new Error("omega: renderer was taken down while loading"); // the page left, or React remounted
  return {
    env: new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture,
    model: {
      root: gltf.scene, clips: gltf.animations, setExpression, setGaze,
      setTint: (body, eye, p) => {
        tintColor.value.set(body); tintMix.value = p;
        shell.emissiveIntensity = baseEmissive * (1 - p);
        glass.opacity = 0.62 * (1 - p);
        const eyeCol = new THREE.Color(1, 1, 1).lerp(new THREE.Color(eye), p);
        exprMeshes.forEach((m) => { (m.material as THREE.MeshBasicMaterial).color.copy(eyeCol); });
      },
      setDark: (dark) => { baseEmissive = dark ? 1 : 0.85; shell.emissiveIntensity = baseEmissive; glass.envMapIntensity = dark ? 0.9 : 0.7; },
      dispose: () => { [dif, emi, orm, eyes1001, eyes1003].forEach((t) => t.dispose()); shell.dispose(); glass.dispose(); exprMeshes.forEach((m) => (m.material as THREE.Material).dispose()); },
    },
  };
}
