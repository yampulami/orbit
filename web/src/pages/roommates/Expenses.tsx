import { useState, type FormEvent } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import Picker from "../../components/Picker";
import { YOU } from "../../lib/hangouts";
import { undo } from "../../lib/undo";
import { money, netBalances, parseCents, removeWithUndo, roomActions, settlements, type Space } from "../../lib/roommates";
import { memberOptions } from "./Avatar";

const name = (n: string) => (n === YOU ? "You" : n);

export default function Expenses({ space }: { space: Space }) {
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const [paidBy, setPaidBy] = useState<string>(YOU);
  const [error, setError] = useState("");

  const people = memberOptions(space.members);
  const payments = space.payments ?? [];
  const net = netBalances(space.members, space.expenses, payments);
  const mine = net[YOU] ?? 0;
  const plan = settlements(net);

  /** Record a payment between two roommates. It can be undone for a few seconds, and deleted later from the Payments list. */
  function markPaid(from: string, to: string, cents: number) {
    const id = roomActions.settle(from, to, cents);
    if (!id) return;
    undo.show(`${name(from)} paid ${name(to)} ${money(cents)}`, { onUndo: () => { roomActions.remove("payments", id); }, commit: () => {} });
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const cents = parseCents(price);
    if (!item.trim()) { setError("What was it for?"); return; }
    if (cents === null) { setError("Enter an amount like 12.50."); return; }
    roomActions.addExpense(item.trim(), cents, paidBy);
    setItem(""); setPrice(""); setError("");
  }

  return (
    <div className="rm-card">
      <form className="rm-add" data-tone="peach" onSubmit={add}>
        <label className="field grow"><span className="sr">What was it for</span><input value={item} onChange={(e) => setItem(e.target.value)} placeholder="What did you buy?" maxLength={60} /></label>
        <label className="field price"><span className="sr">Price</span><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="$0.00" aria-describedby="split-note" /></label>
        <Picker value={paidBy} options={people} onChange={setPaidBy} label="Paid by" />
        <button className="btn primary"><Plus size={18} aria-hidden="true" />Add</button>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="rm-hint" id="split-note">Split equally between all {space.members.length} of you.</p>
      </form>

      <section className={"rm-balance" + (mine > 0 ? " owed" : mine < 0 ? " owe" : "")} aria-label="Your balance">
        <strong>{mine > 0 ? `You’re owed ${money(mine)}` : mine < 0 ? `You owe ${money(-mine)}` : "You’re all settled"}</strong>
        {plan.length > 0 ? (
          <ul className="rm-plan">{plan.map((p) => (
            <li key={p.from + p.to}>
              <span>{name(p.from)} {p.from === YOU ? "pay" : "pays"} {name(p.to)} <b>{money(p.cents)}</b></span>
              <button type="button" className="btn" onClick={() => markPaid(p.from, p.to, p.cents)} aria-label={`${name(p.from)} paid ${name(p.to)} ${money(p.cents)}: mark as paid`}>
                <Check size={16} aria-hidden="true" />{p.from === YOU ? "I paid" : p.to === YOU ? "They paid me" : "Mark as paid"}
              </button>
            </li>
          ))}</ul>
        ) : <p>{space.expenses.length === 0 ? "Add a shared purchase to start keeping track." : "Nobody owes anybody."}</p>}
        {plan.length > 0 && <p className="rm-hint">Paid someone back with cash or an app? Mark it as paid and it is taken off what you owe. Orbit does not move any money.</p>}
      </section>

      {payments.length > 0 && (
        <section aria-label="Payments">
          <h3 className="rm-h">Payments</h3>
          <ul className="rm-list">
            {payments.map((p) => (
              <li key={p.id} className="rm-exp rm-pay">
                <span className="rm-main"><strong>{name(p.from)} paid {name(p.to)}</strong><span className="rm-sub">{new Date(p.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></span>
                <span className="rm-price">{money(p.cents)}</span>
                <button type="button" className="ghost-btn" aria-label={`Delete payment, ${name(p.from)} paid ${name(p.to)} ${money(p.cents)}`} onClick={() => removeWithUndo("payments", p.id, "Payment")}><Trash2 size={16} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {space.expenses.length === 0 ? null : (
        <ul className="rm-list">
          {space.expenses.map((e) => {
            const split = e.split.length ? e.split : space.members;
            const base = Math.floor(e.cents / split.length);
            const extra = e.cents - base * split.length;
            return (
              <li key={e.id} className="rm-exp">
                <details>
                  <summary>
                    <span className="rm-main"><strong>{e.item}</strong><span className="rm-sub">Paid by {name(e.paidBy)} · {new Date(e.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></span>
                    <span className="rm-price">{money(e.cents)}</span>
                  </summary>
                  <div className="rm-break">
                    <p>Split {split.length} ways</p>
                    <ul>
                      {split.map((m, i) => (
                        <li key={m}><span>{name(m)}</span><span>{m === e.paidBy ? `paid ${money(e.cents)}, share ${money(base + (i < extra ? 1 : 0))}` : `owes ${name(e.paidBy)} ${money(base + (i < extra ? 1 : 0))}`}</span></li>
                      ))}
                    </ul>
                    <button type="button" className="ghost-btn wide" onClick={() => removeWithUndo("expenses", e.id, `“${e.item}”`)}><Trash2 size={16} aria-hidden="true" />Delete expense</button>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
