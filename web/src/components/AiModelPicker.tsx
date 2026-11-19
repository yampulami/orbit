import { useEffect } from "react";
import { chooseAiModel, loadAiModels, useAiModels } from "../lib/assistantModel";

/** Which model answers. Shown only when more than one is switched on. If the chosen one was busy and another answered, it says so. */
export default function AiModelPicker() {
  const { models, chosen, via } = useAiModels();
  useEffect(() => { void loadAiModels(); }, []);
  if (models.length < 2) return null;
  const current = models.find((m) => m.id === chosen) ?? models[0];
  return (
    <div className="ac-model">
      <label className="sr" htmlFor="ac-model-pick">Model</label>
      <select id="ac-model-pick" value={current.id} onChange={(e) => chooseAiModel(e.target.value)} title={current.note || undefined}>
        {models.map((m) => <option key={m.id} value={m.id}>{m.label}{m.paid ? " (paid)" : ""}{m.up ? "" : " (busy)"}</option>)}
      </select>
      {via?.fellBack && <span className="ac-model-note" role="status">{via.label} answered, because your pick was busy.</span>}
    </div>
  );
}
