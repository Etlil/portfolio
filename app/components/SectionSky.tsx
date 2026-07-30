"use client";

import { useMemo, type CSSProperties } from "react";
import { useTheme } from "./Theme";

/* The things in the air, drawn into the background of one section.

   These are part of the page, not part of the window: each sprite is placed
   inside the section it belongs to and scrolls away with it. Nothing fades in or
   out and nothing drifts across the screen — they simply exist where they were
   put, the way the rest of the drawings do. Only the fireflies move, and they
   only mill about where they sit.

   Day and night swap outright rather than cross-fading: clouds and birds by day,
   stars by night.

   Mount it as the first child of a section, and make sure that section is
   `position: relative` so the sprites are placed against it.

     <SectionSky seed={2} clouds={6} stars={10} freeze />

   `freeze` is for the pinned sections (Projects, Skills). Those hold still for
   three or four screens of scrolling and freeze the paper background while they
   do (`body.bg-frozen`), so the sky has to hold still with it — otherwise the
   clouds slide up past a background that isn't moving. A sticky layer does it
   with no JS: it locks to the top of the viewport for exactly as long as the
   section is pinned, then scrolls away with the section's end.

   Positioning is inline on purpose: if the stylesheet were ever late or stale,
   class-based `position: absolute` would fail open and drop every sprite into
   the document flow at full size, which wrecks the whole page's layout. Looks
   and motion stay in globals.css. */

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/* Two nested boxes, and the nesting is the whole trick.

   The OUTER box is absolute, so it never takes up room in normal flow — a
   sticky element does, and one 100vh tall shoves the section's real content down
   by a screen (blank gap between sections, content pinning late).

   The INNER box is the sticky one, 100vh tall, and its sticky range is measured
   against the outer box — which spans the section exactly. That makes it release
   at `sectionHeight - 100vh`, the very pixel `body.bg-frozen` is removed and the
   paper starts scrolling again, so the sky and the paper freeze and thaw
   together. (Cancelling the flow box with `margin-bottom: -100vh` instead looks
   equivalent but isn't: a negative bottom margin expands the sticky constraint
   rectangle, and the sky stays stuck a full screen after the paper has let go.)

   `overflow: hidden` has to live on the inner box, never the outer one: overflow
   on an ANCESTOR of a sticky element makes that ancestor its scrollport, which
   silently kills the stickiness altogether. */
const layerBox = (z: number): CSSProperties => ({
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  zIndex: z,
});
const inner = (freeze: boolean): CSSProperties =>
  freeze
    ? { position: "sticky", top: 0, height: "100vh", overflow: "hidden" }
    : { position: "absolute", inset: 0, overflow: "hidden" };

/* Scenery goes behind the page; stars and fireflies shine through the darkness
   by sharing its z-index — equal z-index falls back to document order, and the
   sheet is rendered before the page in layout.tsx, so these paint over it. The
   navbar at 9999 still covers them. */
const BEHIND = -1;
const ABOVE_DARK = 9998;

const sprite: CSSProperties = { position: "absolute", display: "block" };
const img: CSSProperties = { display: "block", width: "100%", height: "auto" };

/* Seeded PRNG — the scatter has to be identical on the server and the client or
   hydration complains. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

type Props = {
  /** Any number — keeps each section's scatter different from the others. */
  seed: number;
  clouds?: number;
  birds?: number;
  stars?: number;
  fireflies?: number;
  /** Set on the pinned sections so the sky freezes with their background. */
  freeze?: boolean;
};

export default function SectionSky({
  seed,
  clouds = 0,
  birds = 0,
  stars = 0,
  fireflies = 0,
  freeze = false,
}: Props) {
  const { dark } = useTheme();

  const placed = useMemo(() => {
    const rand = mulberry32(seed * 7919 + 13);
    /* `top` spans the whole section, which for the pinned ones is three or four
       screens tall — that's what spreads them out as you scroll through. Bands
       rather than free-for-all: purely random tops clump, which left whole
       screens of the Projects section with no cloud in them at all. One sprite
       per band, jittered inside it, so coverage is even however tall the section
       is. */
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const spread = (n: number) =>
      Array.from({ length: n }, (_, id) => {
        const band = (id + 0.5) / n;
        const jitter = (rand() - 0.5) * (0.85 / n);
        return {
          id,
          top: round(clamp(band + jitter, 0.01, 0.98) * 95),
          left: round(1 + rand() * 92),
          r: rand(),
        };
      });
    return {
      clouds: spread(clouds).map((c) => ({
        ...c,
        width: Math.round(120 + c.r * 150),
        opacity: round(0.26 + c.r * 0.24),
        flip: c.r > 0.5,
      })),
      birds: spread(birds).map((b) => ({
        ...b,
        width: Math.round(26 + b.r * 22),
        opacity: round(0.4 + b.r * 0.2),
      })),
      stars: spread(stars).map((s) => ({
        ...s,
        size: Math.round(16 + s.r * 26),
        dim: round(0.7 + s.r * 0.3),
        dur: round(2.6 + s.r * 4.4),
        delay: round(-s.r * 6),
        rot: Math.round((s.r - 0.5) * 40),
      })),
      fireflies: spread(fireflies).map((f) => ({
        ...f,
        size: Math.round(13 + f.r * 15),
        wander: round((f.r > 0.5 ? 1 : -1) * (7 + f.r * 12)), // vw
        dur: round(11 + f.r * 13),
        delay: round(-f.r * 20),
        bob: Math.round(26 + f.r * 54),
        bobDur: round(3 + f.r * 3.5),
        blinkDur: round(1.6 + f.r * 2.6),
        blinkDelay: round(-f.r * 5),
      })),
    };
  }, [seed, clouds, birds, stars, fireflies]);

  return (
    <>
      {/* Clouds and birds are scenery: behind the page, and dimmed with it. */}
      <div style={layerBox(BEHIND)} aria-hidden="true">
        <div style={inner(freeze)}>
        {!dark &&
          [
            ...placed.clouds.map((c) => (
              <span
                key={`c${c.id}`}
                style={{ ...sprite, top: `${c.top}%`, left: `${c.left}%`, width: `${c.width}px`, opacity: c.opacity }}
              >
                <img
                  src={c.flip ? "/cloud2.png" : "/cloud1.png"}
                  alt=""
                  draggable={false}
                  style={{ ...img, transform: c.flip ? "scaleX(-1)" : "none" }}
                />
              </span>
            )),
            ...placed.birds.map((b) => (
              <span
                key={`b${b.id}`}
                style={{ ...sprite, top: `${b.top}%`, left: `${b.left}%`, width: `${b.width}px`, opacity: b.opacity }}
              >
                <img src="/bird.png" alt="" draggable={false} style={img} />
              </span>
            )),
          ]}
        </div>
      </div>

      {/* Stars shine over the darkness, so no halo is needed to find them. */}
      {dark && placed.stars.length > 0 && (
        <div style={layerBox(ABOVE_DARK)} aria-hidden="true">
          <div style={inner(freeze)}>
          {placed.stars.map((s) => (
              <span
                key={`s${s.id}`}
                className="amb-star"
                style={vars({
                  ...sprite,
                  top: `${s.top}%`,
                  left: `${s.left}%`,
                  width: `${s.size}px`,
                  "--dim": s.dim,
                  "--rot": `${s.rot}deg`,
                  animationDuration: `${s.dur}s`,
                  animationDelay: `${s.delay}s`,
                })}
              >
                <img src="/star.png" alt="" draggable={false} style={img} />
              </span>
          ))}
          </div>
        </div>
      )}

      {dark && placed.fireflies.length > 0 && (
        <div style={layerBox(ABOVE_DARK)} aria-hidden="true">
          <div style={inner(freeze)}>
          {placed.fireflies.map((f) => (
            <span
              key={`f${f.id}`}
              className="amb-fly"
              style={vars({
                ...sprite,
                top: `${f.top}%`,
                left: `${f.left}%`,
                width: `${f.size}px`,
                "--wander": `${f.wander}vw`,
                animationDuration: `${f.dur}s`,
                animationDelay: `${f.delay}s`,
              })}
            >
              <span
                className="amb-fly__bob"
                style={vars({ display: "block", "--bob": `${-f.bob}px`, animationDuration: `${f.bobDur}s` })}
              >
                <img
                  src="/firefly.png"
                  alt=""
                  draggable={false}
                  className="amb-fly__glow"
                  style={vars({
                    ...img,
                    animationDuration: `${f.blinkDur}s`,
                    animationDelay: `${f.blinkDelay}s`,
                  })}
                />
              </span>
            </span>
          ))}
          </div>
        </div>
      )}
    </>
  );
}
