import { Building2, Car, Globe, LayoutGrid, ShoppingBag, Sofa, type LucideIcon } from "lucide-react";

/** Icon and tint for each community, shared by the filter pills and the post picker. */
export const communityIcon: Record<string, { Icon: LucideIcon; ink: string }> = {
  All: { Icon: LayoutGrid, ink: "var(--ink)" },
  Everyone: { Icon: Globe, ink: "var(--pink-ink)" },
  Commuters: { Icon: Car, ink: "var(--peach-ink)" },
  Residents: { Icon: Building2, ink: "var(--mint-ink)" },
  Roommates: { Icon: Sofa, ink: "var(--lav-ink)" },
  Marketplace: { Icon: ShoppingBag, ink: "var(--butter-ink)" },
};
