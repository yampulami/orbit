import { Reorder, useDragControls } from "framer-motion";
import { GripVertical } from "lucide-react";
import { useRef, type ReactNode } from "react";

/** A list you can rearrange by dragging. `ids` is the current order; `onChange` gets the new one. A dragged row lifts, the others slide out of the way. */
export function ArrangeList({ ids, onChange, axis = "y", className, as = "ul", children }: { ids: string[]; onChange: (ids: string[]) => void; axis?: "x" | "y"; className?: string; as?: "ul" | "div"; children: ReactNode }) {
  return <Reorder.Group as={as} axis={axis} values={ids} onReorder={onChange} className={className}>{children}</Reorder.Group>;
}

/** One row of an ArrangeList. With `handle`, only the grip starts a drag (so the row itself stays a button or link); without it, the whole row drags and a
 *  tap that ends a drag does not count as a click. */
export function ArrangeItem({ id, handle = false, as = "li", className, children, label }: { id: string; handle?: boolean; as?: "li" | "div"; className?: string; children: ReactNode; label?: string }) {
  const controls = useDragControls();
  const dragged = useRef(false);
  return (
    <Reorder.Item
      as={as}
      value={id}
      className={className}
      dragListener={!handle}
      dragControls={handle ? controls : undefined}
      whileDrag={{ scale: 1.06, zIndex: 40, boxShadow: "0 14px 30px -12px rgba(30,15,90,.55)" }}
      transition={{ type: "spring", stiffness: 520, damping: 38 }}
      onDragStart={() => { dragged.current = true; }}
      onDragEnd={() => { window.setTimeout(() => { dragged.current = false; }, 60); }}
      style={{ position: "relative" }}
    >
      {handle && (
        <span className="arr-grip" role="button" aria-label={label ? `Drag to move ${label}` : "Drag to rearrange"} tabIndex={-1} onPointerDown={(e) => controls.start(e)}>
          <GripVertical size={14} aria-hidden="true" />
        </span>
      )}
      <div style={{ display: "contents" }} onClickCapture={(e) => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); } }}>{children}</div>
    </Reorder.Item>
  );
}
