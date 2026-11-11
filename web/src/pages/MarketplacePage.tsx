import Marketplace from "../components/Marketplace";

/** The marketplace on its own page. The page title is in the top bar, so the heading here is only for screen readers. */
export default function MarketplacePage() {
  return (
    <div className="page mk-page">
      <h1 className="sr">Marketplace</h1>
      <Marketplace />
    </div>
  );
}
