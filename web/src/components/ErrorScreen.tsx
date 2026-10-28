import { Link } from "react-router-dom";
import { RotateCw } from "lucide-react";
import OrbLoader from "./OrbLoader";

/** When something could not load or was not found: the sphere, plain words, and a button that reloads the page. */
export default function ErrorScreen({ label = "Oops", title, message, detail, onRetry, home }: {
  label?: string; title: string; message: string; detail?: string;
  /** A second way out that stays in the app (for example, trying the screen again). */
  onRetry?: () => void;
  /** Show a link back to Orbit. */
  home?: boolean;
}) {
  return (
    <div className="err" role="alert">
      <OrbLoader tone="error" label={label} />
      <h1>{title}</h1>
      <p className="muted">{message}</p>
      {detail && <p className="err-detail">{detail}</p>}
      <div className="err-actions">
        <button type="button" className="btn primary" onClick={() => location.reload()}><RotateCw size={16} aria-hidden="true" /> Reload page</button>
        {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
        {home && <Link className="btn" to="/app">Back to Orbit</Link>}
      </div>
    </div>
  );
}
