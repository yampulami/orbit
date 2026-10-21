import { useMemo } from "react";
import { useCampusData, type Place } from "./campus";
import { statusOf, useProposals, type Proposal } from "./placeVotes";

/** A place on the map. `open` ones are student proposals still waiting for confirmations; they are shown, but not offered as a hangout spot yet. */
export type MapPlace = Place & { open?: boolean; proposal?: Proposal };

const fromProposal = (p: Proposal): MapPlace => ({ id: p.id, name: p.name, category: p.category, lat: p.lat, lng: p.lng, blurb: p.details, proposal: p });

/** The campus's places: the loaded list, plus student proposals that have been confirmed, plus the ones still open for votes. */
export function useMapPlaces() {
  const data = useCampusData();
  const all = useProposals();
  return useMemo(() => {
    const mine = all.filter((p) => p.campusKey === data.campus?.key);
    const accepted = mine.filter((p) => statusOf(p) === "accepted").map(fromProposal);
    const open = mine.filter((p) => statusOf(p) === "open").map((p) => ({ ...fromProposal(p), open: true }));
    const live: MapPlace[] = [...data.places, ...accepted];
    return { ...data, live, places: [...live, ...open] as MapPlace[], open };
  }, [data, all]);
}
