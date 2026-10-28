import ErrorScreen from "../components/ErrorScreen";

/** A web address that goes nowhere. */
export default function NotFound() {
  return <ErrorScreen label="404" title="We cannot find that page" message="The link may be old, or the page may have moved. You can reload, or head back to Orbit." home />;
}
