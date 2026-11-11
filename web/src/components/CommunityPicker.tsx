import { communities, type Community } from "../shared/feed";
import { communityIcon } from "../lib/communityUi";
import Picker, { type PickerOption } from "./Picker";

// Things for sale are listed in the marketplace (Campus, For sale), not posted to the feed.
const options: PickerOption<Community>[] = communities.filter((c) => c !== "Marketplace").map((c) => {
  const { Icon, ink } = communityIcon[c];
  return { value: c, label: c, icon: <span style={{ color: ink, display: "inline-flex" }}><Icon size={16} strokeWidth={1.9} aria-hidden="true" /></span> };
});

/** The "Post to" list on the composer. */
export default function CommunityPicker({ value, onChange, labelledBy, id = "community" }: { value: Community; onChange: (c: Community) => void; labelledBy?: string; id?: string }) {
  return <Picker value={value} options={options} onChange={onChange} labelledBy={labelledBy} id={id} />;
}
