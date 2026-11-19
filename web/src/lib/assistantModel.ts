import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { TOOLS, type ModelMsg } from "./assistantAi";

/** The models a student may pick from (the `assistant` function lists the ones it has keys for), which one is picked, and which one answered last. */
export type AiModelInfo = { id: string; label: string; note: string; paid: boolean; up: boolean };
type ModelsState = { models: AiModelInfo[]; chosen: string; via: { id: string; label: string; fellBack: boolean } | null; loaded: boolean };
const KEY = "orbit-ai-model";
const readChosen = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
let mstate: ModelsState = { models: [], chosen: readChosen(), via: null, loaded: false };
const msubs = new Set<() => void>();
const mset = (n: ModelsState) => { mstate = n; msubs.forEach((f) => f()); };
export const useAiModels = () => useSyncExternalStore((cb) => { msubs.add(cb); return () => { msubs.delete(cb); }; }, () => mstate);

/** Ask the function which models are on. Quietly does nothing without a database or when the function is not there. */
export async function loadAiModels(): Promise<void> {
  if (!supabase || mstate.loaded) return;
  mset({ ...mstate, loaded: true });
  try {
    const { data, error } = await supabase.functions.invoke("assistant", { body: { action: "models" } });
    const d = data as { models?: AiModelInfo[]; default?: string } | null;
    if (error || !d?.models?.length) return;
    const chosen = d.models.some((m) => m.id === mstate.chosen) ? mstate.chosen : d.default ?? d.models[0].id;
    mset({ ...mstate, models: d.models, chosen });
  } catch { /* the built-in answers still work */ }
}
export function chooseAiModel(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* it still applies for this visit */ }
  mset({ ...mstate, chosen: id, via: null });
}

/** Why the AI could not answer, in words for the student. "off" means it is not switched on, so the built-in answers are used instead. */
export class AiProblem extends Error {
  constructor(readonly code: "off" | "busy" | "slow_down" | "sign_in" | "failed", message: string) { super(message); }
}

/** Ask the model (through the `assistant` edge function, which keeps the API key). Only works with a database and a signed-in student. */
export async function askModel(messages: ModelMsg[], context: { name: string; now: string; timezone: string; campus?: string }): Promise<ModelMsg> {
  if (!supabase) throw new AiProblem("off", "The AI needs an account.");
  // Give up after 30 seconds rather than leaving the dots spinning.
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), 30_000);
  let result: Awaited<ReturnType<typeof supabase.functions.invoke>>;
  try { result = await supabase.functions.invoke("assistant", { body: { messages, tools: TOOLS, context, model: mstate.chosen || undefined }, signal: ctl.signal } as never); }
  catch { throw new AiProblem("failed", "The AI took too long to answer (over 30 seconds). The model may be slow or unavailable."); }
  finally { window.clearTimeout(timer); }
  const { data, error } = result;
  if (error && ctl.signal.aborted) throw new AiProblem("failed", "The AI took too long to answer (over 30 seconds). The model may be slow or unavailable.");
  if (error) {
    let code = "", status = 0, detail = "";
    try {
      const body = (await (error as { context?: Response }).context?.clone().json()) as { error?: string; status?: number; detail?: string } | undefined;
      code = body?.error ?? ""; status = body?.status ?? 0; detail = body?.detail ?? "";
    } catch { /* no body */ }
    if (code === "model_error") console.warn("The AI service refused the request:", status, detail);
    if (code === "no_key" || /not found|404/i.test(String(error.message))) throw new AiProblem("off", "The AI is not switched on yet.");
    if (code === "busy" || code === "slow_down") throw new AiProblem("busy", "The AI is busy right now. Give it a minute.");
    if (code === "sign_in") throw new AiProblem("sign_in", "Sign in to use the AI.");
    if (code === "model_error" && (status === 401 || status === 403)) throw new AiProblem("failed", "The AI service did not accept the key. Check the AI_API_KEY secret.");
    if (code === "model_error") throw new AiProblem("failed", `The AI service refused the request (error ${status || "unknown"}${detail ? `: ${detail.replace(/\s+/g, " ").slice(0, 160)}` : ""}).`);
    throw new AiProblem("failed", "The AI could not answer just now.");
  }
  const out = data as { message?: ModelMsg; model?: { id: string; label: string; fellBack: boolean } } | null;
  const m = out?.message;
  if (!m) throw new AiProblem("failed", "The AI did not answer.");
  mset({ ...mstate, via: out?.model ?? null });
  return m;
}
