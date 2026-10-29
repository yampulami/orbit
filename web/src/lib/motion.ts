import type { Transition, Variants } from "framer-motion";

/** Exponential ease-out: confident arrivals from an already-visible default. */
export const ease = [0.16, 1, 0.3, 1] as const;

export const enter: Transition = { duration: 0.22, ease };
export const exit: Transition = { duration: 0.12, ease: "easeIn" };
/** One shared spring for the sliding nav indicator, so sidebar and tab bar move alike. */
export const slide: Transition = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 };

/** Lists arrive row by row: each row eases in from the right and a little below, with a tiny tilt, on a soft spring. */
export const sweepSpring: Transition = { type: "spring", stiffness: 400, damping: 35, mass: 0.5 };
export const sweepList: Variants = {
  hidden: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
};
export const sweepItem: Variants = {
  hidden: { opacity: 0, x: 10, y: 15, rotate: 1 },
  visible: { opacity: 1, x: 0, y: 0, rotate: 0, transition: sweepSpring },
};

