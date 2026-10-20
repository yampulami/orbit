import type { Transition } from "framer-motion";

/** Exponential ease-out: confident arrivals from an already-visible default. */
export const ease = [0.16, 1, 0.3, 1] as const;

export const enter: Transition = { duration: 0.22, ease };
export const exit: Transition = { duration: 0.12, ease: "easeIn" };
/** One shared spring for the sliding nav indicator, so sidebar and tab bar move alike. */
export const slide: Transition = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 };
