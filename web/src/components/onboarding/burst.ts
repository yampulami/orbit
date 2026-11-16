/** A little burst of confetti from a point on the screen: for when you choose something in setup, and a bigger one when you arrive at the last page.
 *  Each piece is a small element that flies out and fades (the Web Animations API, no library), and removes itself. Nothing happens with reduced motion. */
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function burst(x: number, y: number, colors: string[], count = 12, power = 1) {
  if (typeof document === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < count; i++) {
    const size = rnd(5, 9), round = Math.random() < 0.55;
    const el = document.createElement("span");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${round ? size : size * 0.6}px;border-radius:${round ? "50%" : "2px"};background:${colors[i % colors.length]};pointer-events:none;z-index:2000000;will-change:transform,opacity`;
    document.body.appendChild(el);
    const a = rnd(0, Math.PI * 2), d = rnd(40, 100) * power;
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d - rnd(14, 46) * power;
    const anim = el.animate(
      [
        { transform: "translate(-50%,-50%) scale(1) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px),calc(-50% + ${dy * 0.7}px)) scale(1) rotate(${rnd(-160, 160)}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy + 46 * power}px)) scale(0.3) rotate(${rnd(-320, 320)}deg)`, opacity: 0 },
      ],
      { duration: rnd(620, 1050), easing: "cubic-bezier(.2,.7,.3,1)" },
    );
    anim.onfinish = () => el.remove();
  }
}
