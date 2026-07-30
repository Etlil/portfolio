"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import SectionSky from "./SectionSky";

type Skill = { file: string; label: string };
type Group = { heading: string; skills: Skill[] };

const groups: Group[] = [
  {
    heading: "Frontend",
    skills: [
      { file: "html", label: "HTML" },
      { file: "css", label: "CSS, Bootstrap, Tailwind CSS" },
      { file: "js", label: "JavaScript" },
      { file: "ts", label: "TypeScript" },
      { file: "react", label: "React & React Native" },
      { file: "angular", label: "Angular" },
      { file: "vue", label: "Vue.js" },
      { file: "nextjs", label: "Next.js" },
      { file: "capacitor", label: "Capacitor" },
      { file: "phaser", label: "Phaser" },
    ],
  },
  {
    heading: "Backend",
    skills: [
      { file: "php", label: "PHP" },
      { file: "laravel", label: "Laravel" },
      { file: "livewire", label: "Livewire" },
      { file: "java", label: "Java" },
      { file: "python", label: "Python" },
      { file: "kotlin", label: "Kotlin" },
      { file: "nodejs", label: "Node.js" },
      { file: "mysql", label: "MySQL" },
      { file: "postgre", label: "PostgreSQL" },
      { file: "mongodb", label: "MongoDB" },
      { file: "sqlite", label: "SQLite" },
    ],
  },
  {
    heading: "Tools",
    skills: [
      { file: "git", label: "Git" },
      { file: "github", label: "GitHub" },
      { file: "vercel", label: "Vercel" },
      { file: "claude", label: "Claude Code" },
      { file: "ps", label: "Photoshop" },
      { file: "pr", label: "Premiere Pro" },
      { file: "id", label: "InDesign" },
      { file: "ms", label: "Microsoft Office" },
    ],
  },
];

// Pencil by day, chalk by night — both live in globals.css.
const GRAPHITE = "var(--ink)";
const GRAPHITE_SOFT = "var(--ink-soft)";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/* Seeded PRNG (mulberry32). Deterministic so the scatter is identical on the
   server and the client — otherwise every re-render would reshuffle the icons
   and SSR/hydration wouldn't match. */
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

type Placed = { x: number; y: number; rot: number; mult: number };

// Inset of the icon *centres* within a board, as percentages. X stops well short
// of the right edge so a hover label has room to unfurl without leaving the card.
const X_MIN = 8, X_MAX = 76, Y_MIN = 12, Y_MAX = 88;

/* Scatter `count` icons across a card as percentages. A jittered grid keeps them
   spread out (no clumps) while still looking hand-placed. Values are rounded so
   the sub-pixel PRNG output can't drift between Node and the browser. */
function scatter(seed: number, count: number): Placed[] {
  const rand = mulberry32(seed);
  // Pick a grid that suits a wide board, then hand out icons across balanced
  // rows so every row is roughly as full as the others — no clumps, no gaps.
  const cols = Math.max(1, Math.min(count, Math.round(Math.sqrt(count * 2.4))));
  const rows = Math.max(1, Math.ceil(count / cols));
  const perRow: number[] = [];
  let left = count;
  for (let r = 0; r < rows; r++) {
    const n = Math.ceil(left / (rows - r));
    perRow.push(n);
    left -= n;
  }
  const out: Placed[] = [];
  for (let r = 0; r < rows; r++) {
    const n = perRow[r];
    const by = rows === 1 ? 0.5 : (r + 0.5) / rows;
    for (let c = 0; c < n; c++) {
      const bx = (c + 0.5) / n;
      const jx = ((rand() - 0.5) * 0.5) / n; // ±¼ cell — even, but not a rigid grid
      const jy = ((rand() - 0.5) * 0.5) / rows;
      out.push({
        x: round2(X_MIN + clamp01(bx + jx) * (X_MAX - X_MIN)),
        y: round2(Y_MIN + clamp01(by + jy) * (Y_MAX - Y_MIN)),
        rot: Math.round((rand() - 0.5) * 20), // ±10°
        mult: round2(0.9 + rand() * 0.2), // subtle size variety 0.9–1.1
      });
    }
  }
  return out;
}

/* One relaxation run: separate every overlapping pair along its shallowest axis
   until nothing touches, keeping centres inside [X_MIN, xMax] / [Y_MIN, Y_MAX].
   Reports whether it actually settled, so the caller can loosen a constraint
   and try again on a board too cramped for the ideal spacing. */
function relax(
  placed: Placed[],
  sizes: number[],
  boardW: number,
  boardH: number,
  xMax: number,
  gap: number
): { placed: Placed[]; settled: boolean } {
  const n = placed.length;
  const xs = placed.map((p) => (p.x / 100) * boardW);
  const ys = placed.map((p) => (p.y / 100) * boardH);

  // Centres stay within the design inset, but never so close to an edge that
  // the icon itself hangs off the board.
  const bounds = sizes.map((s) => {
    const half = s / 2;
    const loX = Math.max((X_MIN / 100) * boardW, half);
    const hiX = Math.max(loX, Math.min((xMax / 100) * boardW, boardW - half));
    const loY = Math.max((Y_MIN / 100) * boardH, half);
    const hiY = Math.max(loY, Math.min((Y_MAX / 100) * boardH, boardH - half));
    return { loX, hiX, loY, hiY };
  });
  const clampTo = (i: number) => {
    const b = bounds[i];
    xs[i] = Math.min(b.hiX, Math.max(b.loX, xs[i]));
    ys[i] = Math.min(b.hiY, Math.max(b.loY, ys[i]));
  };

  let moved = true;
  for (let pass = 0; pass < 220 && moved; pass++) {
    moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = xs[j] - xs[i];
        const dy = ys[j] - ys[i];
        // Icons are squares, so overlap is an AABB test, not a circle one.
        const ox = (sizes[i] + sizes[j]) / 2 + gap - Math.abs(dx);
        const oy = (sizes[i] + sizes[j]) / 2 + gap - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue; // already clear on one axis
        moved = true;
        if (ox < oy) {
          const push = (ox / 2) * (dx < 0 ? -1 : 1);
          xs[i] -= push;
          xs[j] += push;
        } else {
          const push = (oy / 2) * (dy < 0 ? -1 : 1);
          ys[i] -= push;
          ys[j] += push;
        }
        clampTo(i);
        clampTo(j);
      }
    }
  }

  return {
    settled: !moved, // false => it ran out of passes still resolving overlaps
    placed: placed.map((p, i) => ({
      ...p,
      x: round2((xs[i] / boardW) * 100),
      y: round2((ys[i] / boardH) * 100),
    })),
  };
}

/* Guaranteed-clear fallback for a board too cramped to relax — a phone card is
   barely three icons wide, and nudging pairs apart inside those bounds just
   deadlocks. Drops the icons onto the roomiest grid the board can hold, taking
   the widest icon as the cell size so every pair clears by `gap` no matter which
   two are adjacent. Rotation and size variety are preserved, and each icon is
   offset within its cell by whatever slack is left, so it still reads as
   hand-placed rather than as a table. */
function gridFit(placed: Placed[], sizes: number[], boardW: number, boardH: number, xMax: number): Placed[] {
  const n = placed.length;
  const big = Math.max(...sizes);
  const half = big / 2;
  const loX = Math.max((X_MIN / 100) * boardW, half);
  const hiX = Math.max(loX, Math.min((xMax / 100) * boardW, boardW - half));
  const loY = Math.max((Y_MIN / 100) * boardH, half);
  const hiY = Math.max(loY, Math.min((Y_MAX / 100) * boardH, boardH - half));
  const spanX = hiX - loX;
  const spanY = hiY - loY;

  // Roomiest grid the board can still clear `gap` on, in both axes. Balanced
  // rows never exceed the column count, so checking the row pitch is enough.
  let rows = n, gap = 0;
  for (const g of [10, 6, 2, 0]) {
    const cell = big + g;
    const c = Math.max(1, Math.min(n, Math.floor(spanX / cell) + 1));
    const r = Math.ceil(n / c);
    if (r === 1 || spanY / (r - 1) >= cell || g === 0) {
      rows = r;
      gap = g;
      break;
    }
  }

  // Balanced row counts, so no row is left nearly empty.
  const perRow: number[] = [];
  let left = n;
  for (let r = 0; r < rows; r++) {
    const take = Math.ceil(left / (rows - r));
    perRow.push(take);
    left -= take;
  }

  // Keep the scatter's reading order so the arrangement still resembles it.
  const order = placed
    .map((_, i) => i)
    .sort((a, b) => placed[a].y - placed[b].y || placed[a].x - placed[b].x);

  const out = placed.slice();
  const rowStep = rows > 1 ? spanY / (rows - 1) : 0;
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const m = perRow[r];
    const colStep = m > 1 ? spanX / (m - 1) : 0;
    const slackX = Math.max(0, (colStep - big - gap) / 2);
    const slackY = Math.max(0, (rowStep - big - gap) / 2);
    for (let c = 0; c < m; c++) {
      const i = order[k++];
      // Re-use the icon's own rotation (±10°) as a deterministic jitter source —
      // no PRNG needed here, and the offset can't exceed the cell's spare room.
      const wobble = placed[i].rot / 10;
      // Clamped because the edge cells have no room to wobble outwards.
      const cx = Math.min(hiX, Math.max(loX, (m > 1 ? loX + c * colStep : (loX + hiX) / 2) + wobble * slackX));
      const cy = Math.min(hiY, Math.max(loY, (rows > 1 ? loY + r * rowStep : (loY + hiY) / 2) + wobble * slackY));
      out[i] = { ...placed[i], x: round2((cx / boardW) * 100), y: round2((cy / boardH) * 100) };
    }
  }
  return out;
}

/* Push overlapping icons apart until none of them touch.

   The scatter above only knows percentages, but whether two icons actually
   collide depends on the board's real pixel size and the clamped icon size —
   facts that only exist in the browser. So this runs client-side on measured
   values, and it barely disturbs the hand-placed look because pairs are only
   nudged along the axis they overlap least. `sizes` are icon widths in px,
   index-matched to `placed`; the result is percentages again, so it stays
   resolution-independent.

   A phone-sized board can't hold eleven icons at arm's length, so constraints
   are given up in order of how little they cost: first the gutter kept clear on
   the right for hover labels (which a touch screen never shows anyway), then the
   breathing room between icons, and finally the scatter itself. Not touching
   wins. */
function separate(placed: Placed[], sizes: number[], boardW: number, boardH: number): Placed[] {
  const ATTEMPTS: [xMax: number, gap: number][] = [
    [X_MAX, 10], // ideal — label gutter intact, icons comfortably apart
    [92, 10], // spill into the gutter
    [92, 4], // ...and tighten the spacing
  ];
  for (const [xMax, gap] of ATTEMPTS) {
    const attempt = relax(placed, sizes, boardW, boardH, xMax, gap);
    if (attempt.settled) return attempt.placed;
  }
  return gridFit(placed, sizes, boardW, boardH, 92);
}

const layouts = groups.map((g, gi) => scatter(gi * 97 + 13, g.skills.length));

// Flat running index of the first icon in each card, and the grand total, for
// the scroll-driven light-up.
const offsets: number[] = [];
let running = 0;
for (const g of groups) {
  offsets.push(running);
  running += g.skills.length;
}
const TOTAL_ICONS = running;

/* Scroll progress at which each icon lights up. Each card lights its icons
   within its OWN window, front-loaded so they're all lit well before the card
   slides off screen (a card exits earlier than progress reaches 1, which is why
   a single linear ramp left the later icons of each card dark). The first card
   gets the earliest, tightest window so it lights fast — it exits soonest.
   Within a window the icons go strictly left-to-right by their scattered X. */
const LIGHT_WINDOWS: [number, number][] = [
  [0.0, 0.2], // Frontend — quick
  [0.26, 0.52], // Backend
  [0.58, 0.82], // Tools
];
/* Recomputed whenever the positions change, so the left-to-right order survives
   the separation pass nudging icons around. */
function computeThresholds(placed: Placed[][]): number[] {
  const out = new Array<number>(TOTAL_ICONS);
  groups.forEach((group, col) => {
    const base = offsets[col];
    const [start, end] = LIGHT_WINDOWS[col] ?? [col / groups.length, (col + 1) / groups.length];
    const n = group.skills.length;
    const byX = group.skills.map((_, idx) => idx).sort((a, b) => placed[col][a].x - placed[col][b].x);
    byX.forEach((idx, rank) => {
      out[base + idx] = start + ((rank + 1) / (n + 1)) * (end - start);
    });
  });
  return out;
}

const CARD_GAP = 32;
/* Runway before the first card and after the last one, so they start/land
   inset from the edge instead of flush. Matches the header's 6% gutter. */
const EDGE_PAD = "6vw";
/* Each card is at least 75vw wide, so three of them always overrun the screen
   no matter how wide it is — the row is guaranteed to have room to scroll,
   which is what makes the section pin every time. */
const CARD_WIDTH = "max(320px, 75vw)";
/* Vertical scroll spent per horizontal pixel. >1 slows the slide so the pin
   feels deliberate and the icons have room to light up one at a time. */
const SCROLL_RUNWAY = 1.4;
/* Progress point at which each card's heading fades in as it slides up. */
const cardEnterAt = groups.map((_, col) => (col / groups.length) * 0.75);

// CSS custom properties aren't in the CSSProperties type; this keeps them typed.
const cssVars = (vars: Record<string, string>) => vars as unknown as CSSProperties;

export default function Skills() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // One DOM ref per icon (flat, left-to-right) so the rAF loop can toggle their
  // lit state directly — no React re-render while scrolling.
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
  const boardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const litRef = useRef<boolean[]>(new Array(TOTAL_ICONS).fill(false));

  // Server-rendered scatter first (identical on both sides, so hydration
  // matches), then replaced with the de-overlapped version once measured.
  const [positions, setPositions] = useState<Placed[][]>(layouts);
  const thresholdsRef = useRef<number[]>(computeThresholds(layouts));
  useEffect(() => {
    thresholdsRef.current = computeThresholds(positions);
  }, [positions]);

  const [maxShift, setMaxShift] = useState(0);
  // One flag per card — latched true the first time the card slides into view.
  const [entered, setEntered] = useState<boolean[]>(() => groups.map(() => false));

  const maxShiftRef = useRef(0);
  const enteredRef = useRef<boolean[]>(groups.map(() => false));

  useEffect(() => {
    maxShiftRef.current = maxShift;
  }, [maxShift]);

  /* How far the row overruns the viewport. That overrun is exactly how far we
     slide the row, and it sets the pinned section's height. Because the cards
     are sized to always overrun (CARD_WIDTH), this is always > 0, so the
     section always pins and always converts vertical scroll into horizontal. */
  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      const view = viewportRef.current;
      if (!track || !view) return;
      setMaxShift(Math.max(0, track.scrollWidth - view.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, []);

  /* Re-run the separation pass against the boards' real dimensions, and again
     whenever a resize changes either the board or the (vw-clamped) icon size. */
  useLayoutEffect(() => {
    const relayout = () => {
      const next = groups.map((group, col) => {
        const board = boardRefs.current[col];
        if (!board) return layouts[col];
        const boardW = board.clientWidth;
        const boardH = board.clientHeight;
        if (!boardW || !boardH) return layouts[col];
        const sizes = group.skills.map((_, idx) => {
          const icon = iconRefs.current[offsets[col] + idx]?.firstElementChild as HTMLElement | null;
          return icon?.offsetWidth || 64;
        });
        return separate(layouts[col], sizes, boardW, boardH);
      });
      // Same numbers means the same layout — bail rather than re-render.
      setPositions((prev) =>
        prev.every((col, i) => col.every((p, j) => p.x === next[i][j].x && p.y === next[i][j].y))
          ? prev
          : next
      );
    };

    relayout();
    const ro = new ResizeObserver(relayout);
    boardRefs.current.forEach((b) => b && ro.observe(b));
    return () => ro.disconnect();
  }, []);

  const pinned = maxShift > 0;

  useEffect(() => {
    if (!pinned) return;

    let rafId = 0;
    let target = 0;
    let current = 0;

    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = el.offsetHeight - window.innerHeight;
      target = clamp01(-rect.top / (scrollable || 1));

      // Freeze the paper background while pinned. Projects pins too and shares
      // this class, so both write a flag and freeze if *either* is pinned —
      // that stops the two sections from yanking the freeze off each other.
      const isPinnedNow = rect.top <= 0 && rect.bottom >= window.innerHeight;
      (window as any).__skillsPinned = isPinnedNow;
      const anyPinned = (window as any).__skillsPinned || (window as any).__projectsPinned;
      document.body.classList.toggle("bg-frozen", !!anyPinned);
    };

    const frame = () => {
      // Ease toward the scroll target, then write the slide straight to the DOM
      // node. Doing this imperatively (instead of through React state) is what
      // keeps a 60fps horizontal scroll from re-rendering the whole card tree.
      // Ease the horizontal slide toward Lenis's (already-smoothed) scroll
      // position. A gentle factor (~Lenis's own default) gives that glide feel.
      current += (target - current) * 0.09;
      if (Math.abs(current - target) < 0.0004) current = target;
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-current * maxShiftRef.current}px, 0, 0)`;
      }

      // Light the icons up one by one as the scroll percent passes each one's
      // threshold. classList only changes on a crossing, so this is cheap.
      for (let g = 0; g < TOTAL_ICONS; g++) {
        const lit = current >= thresholdsRef.current[g];
        if (lit !== litRef.current[g]) {
          litRef.current[g] = lit;
          iconRefs.current[g]?.classList.toggle("is-lit", lit);
        }
      }

      // Latch each card's heading fade-in as it reaches its entry point.
      for (let i = 0; i < cardEnterAt.length; i++) {
        if (!enteredRef.current[i] && current >= cardEnterAt[i]) {
          enteredRef.current[i] = true;
          setEntered(enteredRef.current.slice());
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    onScroll();
    rafId = requestAnimationFrame(frame);

    const releaseFreeze = () => {
      (window as any).__skillsPinned = false;
      if (!(window as any).__projectsPinned) {
        document.body.classList.remove("bg-frozen");
      }
    };

    const lenis = (window as unknown as { __lenis?: { on: Function; off: Function } }).__lenis;
    if (lenis) {
      lenis.on("scroll", onScroll);
      return () => {
        lenis.off("scroll", onScroll);
        cancelAnimationFrame(rafId);
        releaseFreeze();
      };
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(rafId);
      releaseFreeze();
    };
  }, [pinned]);

  return (
    <div
      ref={sectionRef}
      id="skills"
      style={{
        position: "relative",
        height: pinned ? `calc(100vh + ${maxShift * SCROLL_RUNWAY}px)` : "auto",
      }}
    >
      <SectionSky seed={3} birds={5} stars={11} freeze />
      {/* Torn-paper edge for the hover labels — referenced from CSS via
          filter: url(#paper-tear). Displacing the label's paper backing with
          fractal noise rips its edges instead of a clean rectangle. */}
      <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="paper-tear" x="-12%" y="-30%" width="124%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03 0.05" numOctaves="4" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* Bigger, chunkier tears for the large cards */}
          <filter id="card-tear" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.013 0.016" numOctaves="4" seed="12" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="24" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div
        className="pin-stage"
        style={{
          position: pinned ? "sticky" : "static",
          top: 0,
          height: pinned ? "100vh" : "auto",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: pinned ? "flex-start" : "center",
          paddingTop: pinned ? "clamp(7rem, 13vh, 8.5rem)" : "6rem",
          paddingBottom: pinned ? "1.5rem" : "6rem",
        }}
      >
        {/* Header — stays put while the cards slide past */}
        <div style={{ position: "relative", zIndex: 1, padding: "0 6%", marginBottom: "2rem" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{ padding: "1.5rem 3rem" }}>
              <p className="text-sm uppercase tracking-widest text-gray-400 mb-2">Expertise</p>
              <h2 className="text-4xl font-bold text-gray-900">Skills</h2>
            </div>
          </div>
        </div>

        {/* Horizontal track. `transform` is set imperatively in the rAF loop,
            so it is deliberately absent here — leaving it out of the style prop
            keeps React from resetting the slide on every re-render. */}
        {/* flex:1 so the cards fill (and vertically center within) the space
            below the pinned header, keeping the "Skills" label clear of the
            fixed navbar during the horizontal scroll.
            overflow-x clips the sliding track horizontally; overflow-y stays
            visible so the cards' top/bottom shadows aren't cut off. */}
        <div
          ref={viewportRef}
          style={{
            position: "relative",
            zIndex: 1,
            overflowX: "clip",
            overflowY: "visible",
            padding: "1.5rem 0",
            flex: pinned ? 1 : "none",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <div
            ref={trackRef}
            style={{
              display: "flex",
              flexDirection: "row",
              gap: `${CARD_GAP}px`,
              width: "max-content",
              paddingLeft: EDGE_PAD,
              paddingRight: EDGE_PAD,
              willChange: "transform",
            }}
          >
            {groups.map((group, col) => {
              const shown = !pinned || entered[col];

              return (
                <div
                  key={group.heading}
                  className="skill-card"
                  style={{
                    flex: "0 0 auto",
                    width: CARD_WIDTH,
                    height: "min(560px, 60vh)",
                    display: "flex",
                    flexDirection: "column",
                    padding: "2.6rem 2.9rem",
                    transform: `rotate(${col === 1 ? 0 : col === 0 ? -0.5 : 0.6}deg)`,
                  }}
                >
                  {/* Heading — fades in as the card enters */}
                  <div
                    style={{
                      opacity: shown ? 1 : 0,
                      transform: shown ? "none" : "translateY(12px)",
                      transition: "opacity 0.6s ease, transform 0.6s ease",
                    }}
                  >
                    <p
                      style={{
                        color: GRAPHITE_SOFT,
                        fontSize: "0.7rem",
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        marginBottom: "0.5rem",
                      }}
                    >
                      {String(col + 1).padStart(2, "0")} / {String(groups.length).padStart(2, "0")}
                    </p>
                    <h3 style={{ color: GRAPHITE, fontSize: "1.6rem", fontWeight: 700 }}>
                      {group.heading}
                    </h3>
                  </div>

                  {/* Scatter board — icons are absolutely placed within it */}
                  <div
                    className="skill-board"
                    ref={(el) => {
                      boardRefs.current[col] = el;
                    }}
                  >
                    {group.skills.map((skill, idx) => {
                      const g = offsets[col] + idx;
                      const pos = positions[col][idx];
                      return (
                        <div
                          key={skill.file}
                          ref={(el) => {
                            iconRefs.current[g] = el;
                          }}
                          className="skill-chip"
                          style={cssVars({
                            left: `${pos.x}%`,
                            top: `${pos.y}%`,
                            "--rot": `${pos.rot}deg`,
                            "--icon": `calc(clamp(46px, 5vw, 82px) * ${pos.mult})`,
                          })}
                        >
                          <div className="skill-icon">
                            <img
                              className="skill-img"
                              src={`/skills/${skill.file}.png`}
                              alt={skill.label}
                              draggable={false}
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <span className="skill-label" aria-hidden="true">
                            {skill.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
