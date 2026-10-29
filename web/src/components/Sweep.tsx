import { motion } from "framer-motion";
import type { ComponentProps } from "react";
import { sweepItem, sweepList } from "../lib/motion";

/** A list whose rows slide in one after another (see `sweepItem`). Use `SweepLi` or `SweepItem` for the rows. Reduced-motion settings turn the movement off. */
export const SweepUl = (props: ComponentProps<typeof motion.ul>) => <motion.ul initial="hidden" animate="visible" variants={sweepList} {...props} />;
export const SweepDiv = (props: ComponentProps<typeof motion.div>) => <motion.div initial="hidden" animate="visible" variants={sweepList} {...props} />;
export const SweepLi = (props: ComponentProps<typeof motion.li>) => <motion.li variants={sweepItem} style={{ originX: 1, originY: 1 }} {...props} />;
export const SweepItem = (props: ComponentProps<typeof motion.div>) => <motion.div variants={sweepItem} style={{ originX: 1, originY: 1 }} {...props} />;
