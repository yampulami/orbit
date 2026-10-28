import { supabase } from "./supabase";
import { TOOLS, type ModelMsg } from "./assistantAi";

/** Why the AI could not answer, in words for the student. "off" means it is not switched on, so the built-in answers are used instead. */
export class AiProblem extends Error {
  constructor(readonly code: "off" | "busy" | "slow_down" | "sign_in" | "failed", message: string) { super(message); }
}

/** Ask the model (through the `assistant` edge function, which keeps the API key). Only works with a database and a signed-in student. */
export async function askModel(messages: ModelMsg[], context: { name: string; now: string; timezone: string; campus?: string }): Promise<ModelMsg> {
  if (!supabase) throw new AiProblem("off", "The AI needs an account.");
  const { data, error } = await supabase.functions.invoke("assistant", { body: { messages, tools: TOOLS, context } });
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
  const m = (data as { message?: ModelMsg } | null)?.message;
  if (!m) throw new AiProblem("failed", "The AI did not answer.");
  return m;
}
