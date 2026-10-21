import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import Picker from "../../components/Picker";
import { YOU } from "../../lib/hangouts";
import { money, netBalances, parseCents, removeWithUndo, roomActions, settlements, type Space } from "../../lib/roommates";
import { memberOptions } from "./Avatar";

const name = (n: string) => (n === YOU ? "You" : n);

export default function Expenses({ space }: { space: Space }) {
  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const [paidBy, setPaidBy] = useState<string>(YOU);
  const [error, setError] = useState("");

  const people = memberOptions(space.members);
  const net = netBalances(space.members, space.expenses);
  const mine = net[YOU] ?? 0;
  const plan = settlements(net);

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
          <ul>{plan.map((p) => <li key={p.from + p.to}>{name(p.from)} {p.from === YOU ? "pay" : "pays"} {name(p.to)} <b>{money(p.cents)}</b></li>)}</ul>
        ) : <p>{space.expenses.length === 0 ? "Add a shared purchase to start keeping track." : "Nobody owes anybody."}</p>}
      </section>

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
