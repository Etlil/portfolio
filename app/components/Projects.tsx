"use client";
import { useEffect, useRef, useState } from "react";
import { useMotionValue, useTransform, motion } from "framer-motion";
import SectionSky from "./SectionSky";

type Project = {
  number: string;
  title: string;
  description: string;
  tech: string[];
  image: string;
  /* Screenshots fill the frame. Line art (the site's own favicon) has to sit
     inside it instead, or it just gets cropped into an unreadable blob. */
  imageFit?: "cover" | "contain";
  color: string; // sticky-note background
  // A link with no url is a status marker ("Work In Progress"), not a dead link.
  links: { label: string; url?: string }[];
};

const projects: Project[] = [
  {
    number: "01",
    title: "Smart Campus Navigation with Queue & Appointment Integration",
    description:
      "Our college capstone, campus navigation with built-in queueing and appointment booking.",
    tech: ["Laravel", "Livewire", "MySQL"],
    image: "/projects/smartcamp.jpg",
    color: "#FCEFA6",
    links: [
      { label: "Visit Website", url: "https://user.map.nlac.online/" },
      {
        label: "Documentation",
        url: "https://drive.google.com/file/d/1PmAi8eGNeewemp0trY_9kP9trqNaCF8G/view?usp=sharing",
      },
    ],
  },
  {
    number: "02",
    title: "Access Control Log System",
    description:
      "An access-control logging system for our Systems Analysis & Design course.",
    tech: ["Laravel", "Angular", "MySQL"],
    image: "/projects/acls.jpg",
    color: "#FBC4D0",
    links: [
      {
        label: "Documentation",
        url: "https://drive.google.com/file/d/1Xrh0uuiRRUW2Z24OIhE_9UMGkFDveorI/view?usp=drive_link",
      },
    ],
  },
  {
    number: "03",
    title: "Northern Luzon Adventist Hospital's Management Information System",
    description:
      "A real hospital MIS built during my internship, an all-in-one platform.",
    tech: ["Laravel", "Livewire", "MySQL"],
    image: "/projects/nlah.jpg",
    color: "#C4E8C2",
    links: [{ label: "Visit Website", url: "https://nlah.leuvhano.fun" }],
  },
  {
    number: "04",
    title: "Mobile Point of Sales System (Android)",
    description:
      "An offline-capable Android point-of-sale app I built for fun.",
    tech: ["Kotlin", "Java", "SQLite"],
    image: "/projects/mpos.jpg",
    color: "#BBD9F0",
    links: [
      {
        label: "Download the App",
        url: "https://drive.google.com/file/d/1qCOKJVIahaWr-S4-7NZNJLjD9uc2Q9A9/view?usp=sharing",
      },
    ],
  },
  {
    number: "05",
    title: "Chrono Paradox",
    description:
      "A 2D time-travel game, I coded it and hand-drew every asset myself.",
    tech: ["Phaser", "Angular"],
    image: "/projects/chrono.jpg",
    color: "#D9C6EE",
    links: [
      {
        label: "View Screenshots",
        url: "https://drive.google.com/drive/folders/1A39Us26wM1ock8A9AZq-fEP57Xb11l6f?usp=sharing",
      },
    ],
  },
  {
    number: "06",
    title: "Omori-Inspired Portfolio Website",
    description:
      "A portfolio site themed after my favorite game, Omori.",
    tech: ["Next.js", "Vercel"],
    image: "/projects/portfolio.jpg",
    color: "#FBD0A6",
    links: [{ label: "Visit Website", url: "https://etlils-portfolio.vercel.app/" }],
  },
  {
    number: "07",
    title: "Hand-Drawn Portfolio (This Very Site)",
    description:
      "The one you're looking at, a paper-and-pencil portfolio, built with Claude Code as my pair.",
    tech: ["Next.js", "TypeScript", "Tailwind CSS", "Phaser", "Vercel", "Claude Code"],
    image: "/icon.svg", // the site's own favicon, served by app/icon.svg
    imageFit: "contain",
    color: "#B7E4E0",
    links: [{ label: "View Source", url: "https://github.com/Etlil/portfolio" }],
  },
  {
    number: "08",
    title: "Prism: Mood-Tracking Photo Journal",
    description:
      "A year of moods as colored pixels, tap any day to journal and attach photos.",
    tech: ["Vue.js", "PostgreSQL", "Capacitor", "Claude Code"],
    image: "/projects/prism.png",
    color: "#F0C3E0",
    links: [
      {
        label: "Download the App",
        url: "https://drive.google.com/file/d/1wNit7u3Dd9bGQJdpuwg5nEgCKI6BRaBm/view?usp=sharing",
      },
    ],
  },
  {
    number: "09",
    title: "UkeNote: Ukulele Tuner & Chord Book",
    description:
      "A ukulele companion — tuner, chord database, and songs you chart yourself.",
    tech: ["React Native", "SQLite", "Claude Code"],
    image: "/projects/ukenote.png",
    color: "#D7E3A8",
    links: [
      { label: "Download the App",
        url:"https://drive.google.com/file/d/1eyZUZPIIlNU5J26tSquvAwX7EcVu-xXd/view?usp=drive_link"
      }],
  },
];

// Map a tech/tool name to its icon in /public/skills. Falls back to a text
// chip when there's no matching icon (e.g. Volt).
const TECH_ICON: Record<string, string> = {
  Laravel: "laravel",
  Livewire: "livewire",
  MySQL: "mysql",
  PostgreSQL: "postgre",
  Angular: "angular",
  "Vue.js": "vue",
  Kotlin: "kotlin",
  Java: "java",
  SQLite: "sqlite",
  Phaser: "phaser",
  "Next.js": "nextjs",
  React: "react",
  "React Native": "react", // same logo, no separate doodle

  PHP: "php",
  JavaScript: "js",
  TypeScript: "ts",
  "Node.js": "nodejs",
  Capacitor: "capacitor",
  HTML: "html",
  CSS: "css",
  "Tailwind CSS": "css", // the CSS doodle covers Bootstrap/Tailwind in Skills too
  Python: "python",
  MongoDB: "mongodb",
  Git: "git",
  GitHub: "github",
  Vercel: "vercel",
  "Claude Code": "claude",
};

/* The card's DESIGN size. Every number inside a card — the padding, the type
   sizes, the 30px tech icons — is drawn against these two, and the whole stack
   is then scaled as one to fit whatever room the pinned stage actually has (see
   `fit` below). That is why these stay constant: they are the unit the artwork
   is drawn in, not a measurement of the screen. */
const CARD_W = 280;
const CARD_H = 460;
const BASE_OFFSET_X = 215;
const BASE_OFFSET_Y = 18;

/* Below this the fanned-out layout has nowhere to fan to, and the cards stack
   vertically instead. Measured against the stage, not the window, so it is the
   room actually available that decides. */
const FAN_MIN_WIDTH = 560;

export default function Projects() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useMotionValue(0);
  const smoothProgress = useMotionValue(0);
  useEffect(() => {
    let rafId: number;

    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      /* How far the section can scroll while pinned is section height minus the
         PINNED CONTAINER's height — not minus `window.innerHeight`. On a
         desktop those are the same number and the shortcut is invisible. On a
         phone they are not: `window.innerHeight` is the visible viewport with
         the address bar showing, while the sticky stage is sized in `svh`, and
         the bar hiding on the first flick changes one and not the other. The
         card stack would then finish its run early or never quite arrive.
         Measuring the element that is actually doing the sticking keeps the
         progress exact whatever the browser chrome is doing. */
      const pinH = containerRef.current?.offsetHeight || window.innerHeight;
      const scrollable = el.offsetHeight - pinH;
      const raw = Math.min(1, Math.max(0, -rect.top / (scrollable || 1)));
      scrollProgress.set(raw);

      // Pinned = sticky section is actively in view
      const pinned = rect.top <= 0 && rect.bottom >= pinH;
      (window as any).__projectsPinned = pinned;
      const anyPinned = (window as any).__skillsPinned || (window as any).__projectsPinned;
      document.body.classList.toggle("bg-frozen", !!anyPinned);
    };

    const lerp = () => {
      const current = smoothProgress.get();
      const target = scrollProgress.get();
      const next = current + (target - current) * 0.06;
      smoothProgress.set(Math.abs(next - target) < 0.0001 ? target : next);
      rafId = requestAnimationFrame(lerp);
    };
    rafId = requestAnimationFrame(lerp);

    const lenis = (window as any).__lenis;
    if (lenis) {
      lenis.on("scroll", onScroll);
      return () => {
        lenis.off("scroll", onScroll);
        cancelAnimationFrame(rafId);
      };
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [scrollProgress, smoothProgress]);

  const [dims, setDims] = useState({
    offsetX: BASE_OFFSET_X,
    offsetY: BASE_OFFSET_Y,
    isMobile: false,
    fit: 1,
    stageW: 0,
    stageH: 0,
  });

  /* ── FITTING THE STACK TO THE STAGE ──
     The stack is measured against the box it is actually dropped into — the
     flex child below the header — rather than against the window, because the
     header, the navbar clearance and the section padding have all already been
     taken out of it.

     Two separate things happen here:

       · the fan is TIGHTENED, by shrinking the per-card offsets, so nine cards
         still span the available width rather than running off the side;
       · the whole stack is then SCALED, as a single unit, so it fits the height
         as well.

     The height half is what was missing before, and it bites long before a
     phone does: nine cards at 18px of vertical offset stand 604px tall, and a
     laptop pinned stage has roughly 500px to give once the navbar and the
     section heading have taken their share — so the bottom of every card was
     being clipped on exactly the machine most people would look at this on.

     Scaling rather than re-laying-out is deliberate: a card is a drawing, with
     a photo, a title, a row of 30px tool icons and two links all sized against
     each other. Shrinking the box and letting the contents reflow gives nine
     different-looking cards; scaling the whole thing keeps it the same drawing,
     smaller. */
  useEffect(() => {
    const calc = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const stageW = stage.clientWidth;
      const stageH = stage.clientHeight;
      if (!stageW || !stageH) return;

      const n = projects.length;
      // Narrow enough that a fan has nowhere to fan to — stack the cards
      // vertically instead. This is a question about the room available, not
      // about what kind of device it is: a phone held sideways has plenty of
      // width and should fan like anything else.
      const mobile = stageW < FAN_MIN_WIDTH;

      let offsetX: number;
      let offsetY: number;
      if (mobile) {
        offsetX = 0;
        offsetY = 28;
      } else {
        // Only the offsets shrink — the card itself is a fixed 280px — so the
        // scale has to be measured against the room left *beside* that card.
        // (Scaling against the whole stack width lets it overrun on laptops,
        // and worse with every project added.)
        const maxOffsetW = BASE_OFFSET_X * (n - 1);
        const spread = Math.min(1, Math.max(0, (stageW - CARD_W) / maxOffsetW));
        offsetX = Math.floor(BASE_OFFSET_X * spread);
        offsetY = Math.floor(BASE_OFFSET_Y * spread);
      }

      let naturalW = mobile ? CARD_W : CARD_W + offsetX * (n - 1);
      const naturalH = CARD_H + offsetY * (n - 1);
      const fitH = stageH / naturalH;
      let fit = Math.min(1, stageW / naturalW, fitH);

      /* When HEIGHT is what forced the shrink — a laptop, or a phone on its
         side — the fan ends up narrower than the stage and the cards bunch into
         a column in the middle with empty paper either side. The leftover width
         is free: spend it on a wider fan, so more of each card's face shows.
         Capped at the design offset, so it never spreads further apart than it
         was drawn to. */
      if (!mobile && fit < 1 && fit === fitH) {
        const widened = Math.floor((stageW / fit - CARD_W) / (n - 1));
        offsetX = Math.min(BASE_OFFSET_X, Math.max(offsetX, widened));
        naturalW = CARD_W + offsetX * (n - 1);
        fit = Math.min(1, stageW / naturalW, fitH);
      }

      setDims((prev) =>
        prev.offsetX === offsetX &&
        prev.offsetY === offsetY &&
        prev.isMobile === mobile &&
        Math.abs(prev.fit - fit) < 0.001 &&
        prev.stageW === stageW &&
        prev.stageH === stageH
          ? prev
          : { offsetX, offsetY, isMobile: mobile, fit, stageW, stageH }
      );
    };

    const ro = new ResizeObserver(calc);
    if (stageRef.current) ro.observe(stageRef.current);
    calc();

    return () => ro.disconnect();
  }, []);

  const { offsetX, offsetY, isMobile, fit, stageW, stageH } = dims;
  const totalCards = projects.length;

  // The stack's own coordinate space, before `fit` shrinks it onto the screen.
  const naturalW = isMobile ? CARD_W : CARD_W + offsetX * (totalCards - 1);
  const naturalH = CARD_H + offsetY * (totalCards - 1);
  /* Cards fly in from off-stage. "Off-stage" has to be expressed in the stack's
     own units, so it has to be divided back out of `fit` — a flat 1920px looks
     like a long slide on a desktop and, once the stack is scaled to a third,
     like the cards simply appearing in mid-air a few hundred pixels out. */
  const flyX = stageW / (fit || 1) + CARD_W;
  const flyY = stageH / (fit || 1) + CARD_H;

  return (
    <div
      ref={sectionRef}
      id="projects"
      style={{ position: "relative", height: `calc(var(--svh) * ${100 + totalCards * 30})` }}
    >
      <SectionSky seed={2} clouds={6} stars={11} freeze />
      <div
        ref={containerRef}
        className="pin-stage stage-screen"
        style={{
          position: "sticky",
          top: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          // Top clearance is the navbar's own measured height, so it is right
          // at every breakpoint instead of being a guess that happens to work
          // at one of them.
          padding: "var(--section-top) 5% clamp(0.75rem, 2vh, 1.5rem)",
        }}
      >
        {/* Header — held below the navbar; the stack centers in the space below */}
        <div style={{ marginBottom: "clamp(0.6rem, 2.5vh, 2rem)" }}>
          <p className="text-xs sm:text-sm uppercase tracking-widest text-gray-400 mb-1 sm:mb-2">Work</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
            Selected Projects
          </h2>
        </div>

        {/* Card stack container. This is the box the stack is measured against —
            everything above has already taken its share out of it. */}
        <div
          ref={stageRef}
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
            flex: 1,
            minHeight: 0,
            alignItems: isMobile ? "flex-start" : "center",
          }}
        >
          {/* Outer box occupies the SCALED footprint, so the flex centering
              above still lands the stack in the middle of the stage. */}
          <div
            style={{
              position: "relative",
              width: `${naturalW * fit}px`,
              height: `${naturalH * fit}px`,
            }}
          >
            {/* Inner box keeps the stack's design coordinates; one transform
                shrinks the whole drawing to fit. */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: `${naturalW}px`,
                height: `${naturalH}px`,
                transform: `scale(${fit})`,
                transformOrigin: "top left",
              }}
            >
              {projects.map((p, i) => (
                <ProjectCard
                  key={p.number}
                  project={p}
                  index={i}
                  total={totalCards}
                  scrollProgress={smoothProgress}
                  offsetX={offsetX}
                  offsetY={offsetY}
                  isMobile={isMobile}
                  flyX={flyX}
                  flyY={flyY}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  index,
  total,
  scrollProgress,
  offsetX,
  offsetY,
  isMobile,
  flyX,
  flyY,
}: {
  project: (typeof projects)[0];
  index: number;
  total: number;
  scrollProgress: ReturnType<typeof useMotionValue<number>>;
  offsetX: number;
  offsetY: number;
  isMobile: boolean;
  flyX: number;
  flyY: number;
}) {
  const startAt = index / total;
  const endAt = Math.min(1, (index + 1) / total);

  const isFirstHalf = index < Math.ceil(total / 2);
  // Just past the edge of the stage, in the stack's own units — see `flyX`.
  const xFrom = isMobile ? 0 : isFirstHalf ? -flyX : flyX;
  const yFrom = isMobile ? flyY : 0;

  const xTo = isMobile ? 0 : offsetX * index;
  const yTo = offsetY * index;

  const eased = useTransform(scrollProgress, (v) => {
    const t = Math.min(1, Math.max(0, (v - startAt) / (endAt - startAt)));
    return 1 - Math.pow(1 - t, 4);
  });

  const x = useTransform(eased, [0, 1], [xFrom, xTo]);
  const y = useTransform(eased, [0, 1], [yFrom, yTo]);

  const opacity = useTransform(eased, [0, 0.15], [0, 1]);
  const rotate = useTransform(eased, [0, 1], [8, 0]);

  // Cards further back scale down slightly
  const scale = useTransform(scrollProgress, (v) => {
    if (v < startAt) return 1;
    const depth = total - 1 - index;
    return 1 - depth * 0.015;
  });

  /* Shadow cast by the card stacked on top of this one. Hoisted out of the JSX
     below: it used to be called inside `index < total - 1 && (…)`, which is a
     conditional hook — the day a project is added or removed, `total` changes
     under a live component and React sees the hook order shift. Always call it;
     the JSX decides whether to render the div. */
  const overlapShade = useTransform(scrollProgress, (v) => {
    const nextCardEnd = Math.min(1, (index + 2) / total);
    return v >= nextCardEnd ? 1 : 0;
  });

  return (
    <motion.div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        x,
        y,
        scale,
        opacity,
        rotate,
        transformOrigin: "bottom center",
        willChange: "transform, opacity",
        zIndex: index,
      }}
    >
      {/* Overlay shadow — only covers right portion when a card sits on top */}
      {index < total - 1 && (
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: `${offsetX}px`,
            height: "100%",
            background: "linear-gradient(to left, rgba(0,0,0,0.18), transparent)",
            zIndex: 2,
            pointerEvents: "none",
            opacity: overlapShade,
          }}
        />
      )}
      {/* sticky-note: stays bright paper at night, so its ink stays dark */}
      <div
        className="sticky-note"
        style={{
          backgroundColor: project.color,
          backgroundImage: "url('/paper.svg')",
          backgroundRepeat: "repeat",
          backgroundSize: "300px 300px",
          backgroundBlendMode: "multiply",
          border: "1px solid rgba(0,0,0,0.08)",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
          width: `${CARD_W}px`,
          height: `${CARD_H}px`,
          overflow: "hidden",
        }}
      >
        {/* Framed thumbnail with the number tag */}
        <div style={{ position: "relative" }}>
          <img
            src={project.image}
            alt={project.title}
            draggable={false}
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              objectFit: project.imageFit ?? "cover",
              display: "block",
              border: "3px solid #fff",
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
              // A transparent drawing needs its own paper to sit on, and room
              // to breathe inside the frame — a photo needs neither.
              ...(project.imageFit === "contain" && {
                padding: "14%",
                backgroundColor: "rgba(255,255,255,0.55)",
              }),
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: "rgba(0,0,0,0.68)",
              color: "#fff",
              fontSize: "0.68rem",
              fontWeight: 800,
              letterSpacing: "0.05em",
              padding: "1px 7px",
            }}
          >
            {project.number}
          </span>
        </div>

        <h3
          className="font-bold text-gray-900 leading-tight line-clamp-2"
          style={{ fontSize: "0.98rem", marginTop: "0.15rem" }}
        >
          {project.title}
        </h3>
        <p className="text-gray-700 leading-relaxed line-clamp-2" style={{ fontSize: "0.74rem" }}>
          {project.description}
        </p>

        {/* Tools used — skill icon per tech, text chip when there's no icon */}
        <div className="flex flex-wrap items-center gap-2 mt-auto">
          {project.tech.map((t) => {
            const icon = TECH_ICON[t];
            return icon ? (
              <img
                key={t}
                src={`/skills/${icon}.png`}
                alt={t}
                title={t}
                draggable={false}
                style={{ width: 30, height: 30, objectFit: "contain" }}
              />
            ) : (
              <span
                key={t}
                className="uppercase tracking-wider text-gray-700 px-1.5 py-0.5"
                style={{
                  border: "1px solid rgba(0,0,0,0.22)",
                  backgroundColor: "rgba(255,255,255,0.4)",
                  fontSize: "0.6rem",
                }}
              >
                {t}
              </span>
            );
          })}
        </div>

        {project.links.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {project.links.map((l) =>
              l.url ? (
                <a
                  key={l.label}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="uppercase tracking-widest text-gray-800 underline underline-offset-2 hover:text-black transition-colors"
                  style={{ fontSize: "0.64rem", fontWeight: 600 }}
                >
                  {l.label} ↗
                </a>
              ) : (
                // Nowhere to go yet — no underline and no arrow, so it reads as a
                // status rather than a link that's broken.
                <span
                  key={l.label}
                  className="uppercase tracking-widest text-gray-600"
                  style={{ fontSize: "0.64rem", fontWeight: 600 }}
                >
                  {l.label}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}