"use client";
import { useEffect, useRef, useState } from "react";
import { useMotionValue, useTransform, motion } from "framer-motion";

type Project = {
  number: string;
  title: string;
  description: string;
  tech: string[];
  image: string;
  color: string; // sticky-note background
  links: { label: string; url: string }[];
};

const projects: Project[] = [
  {
    number: "01",
    title: "Smart Campus Navigation with Queue & Appointment Integration",
    description:
      "Our college capstone — campus navigation with built-in queueing and appointment booking. A full-stack team build.",
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
      "An access-control logging system for our Systems Analysis & Design course — our first fully documented R&D project.",
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
      "A real hospital MIS built during my internship — an all-in-one platform: HRIS, payroll, inventory, leave, maintenance and more.",
    tech: ["Laravel", "Livewire", "MySQL"],
    image: "/projects/nlah.jpg",
    color: "#C4E8C2",
    links: [{ label: "Visit Website", url: "https://nlaho.leuvhano.fun" }],
  },
  {
    number: "04",
    title: "Mobile Point of Sales System (Android)",
    description:
      "An offline-capable Android point-of-sale app I built for fun, adapted from my internship POS work.",
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
      "A 2D time-travel game for our Software Engineering course — I coded it and hand-drew every asset myself.",
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
      "A portfolio site themed after my favorite game, Omori — I wanted a portfolio built around a game I love.",
    tech: ["Next.js", "Vercel"],
    image: "/projects/portfolio.jpg",
    color: "#FBD0A6",
    links: [{ label: "Visit Website", url: "https://etlils-portfolio.vercel.app/" }],
  },
];

// Map a tech/tool name to its icon in /public/skills. Falls back to a text
// chip when there's no matching icon (e.g. Livewire, Volt, Vercel).
const TECH_ICON: Record<string, string> = {
  Laravel: "laravel",
  MySQL: "mysql",
  Angular: "angular",
  Kotlin: "kotlin",
  Java: "java",
  SQLite: "sqlite",
  Phaser: "phaser",
  "Next.js": "nextjs",
  React: "react",
  PHP: "php",
  JavaScript: "js",
  HTML: "html",
  CSS: "css",
  Python: "python",
  MongoDB: "mongodb",
  Git: "git",
  GitHub: "github",
};

const CARD_W = 280;
const CARD_H = 460;
const BASE_OFFSET_X = 215;
const BASE_OFFSET_Y = 18;

export default function Projects() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useMotionValue(0);
  const smoothProgress = useMotionValue(0);
  useEffect(() => {
    let rafId: number;

    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = el.offsetHeight - window.innerHeight;
      const raw = Math.min(1, Math.max(0, -rect.top / scrollable));
      scrollProgress.set(raw);

      // Pinned = sticky section is actively in view
      const pinned = rect.top <= 0 && rect.bottom >= window.innerHeight;
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
  });

  useEffect(() => {
    const calc = (containerW: number) => {
      const mobile = containerW < 768;
      if (mobile) {
        setDims({ offsetX: 0, offsetY: 28, isMobile: true });
      } else {
        const availableW = containerW * 0.9; // match the 5% padding on each side
        const maxTotalW = CARD_W + BASE_OFFSET_X * (projects.length - 1);
        const scale = Math.min(1, availableW / maxTotalW);
        setDims({
          offsetX: Math.floor(BASE_OFFSET_X * scale),
          offsetY: Math.floor(BASE_OFFSET_Y * scale),
          isMobile: false,
        });
      }
    };

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) calc(w);
    });

    if (containerRef.current) {
      ro.observe(containerRef.current);
      calc(containerRef.current.offsetWidth);
    }

    return () => ro.disconnect();
  }, []);

  const { offsetX, offsetY, isMobile } = dims;
  const totalCards = projects.length;

  return (
    <div
      ref={sectionRef}
      id="projects"
      style={{ height: `${100 + totalCards * 30}vh` }}
    >
      <div
        ref={containerRef}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: isMobile ? "flex-start" : "center",
          padding: isMobile ? "5rem 5% 2rem" : "0 5%",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p className="text-sm uppercase tracking-widest text-gray-400 mb-2">Work</p>
          <h2 className="text-4xl font-bold text-gray-900">Selected Projects</h2>
        </div>

        {/* Card stack container */}
        <div style={{ display: "flex", justifyContent: "center", width: "100%", flex: isMobile ? 1 : "unset", alignItems: isMobile ? "flex-start" : "unset" }}>
        <div
          style={{
            position: "relative",
            width: isMobile ? `${CARD_W}px` : `${CARD_W + offsetX * (totalCards - 1)}px`,
            height: isMobile
              ? `${CARD_H + offsetY * (totalCards - 1)}px`
              : `${CARD_H + offsetY * (totalCards - 1)}px`,
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
            />
          ))}
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
}: {
  project: (typeof projects)[0];
  index: number;
  total: number;
  scrollProgress: ReturnType<typeof useMotionValue<number>>;
  offsetX: number;
  offsetY: number;
  isMobile: boolean;
}) {
  const startAt = index / total;
  const endAt = Math.min(1, (index + 1) / total);

  const isFirstHalf = index < Math.ceil(total / 2);
  const xFrom = isMobile ? 0 : isFirstHalf ? -1920 : 1920;
  const yFrom = isMobile ? 1080 : 0;

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
            opacity: useTransform(scrollProgress, (v) => {
              const nextCardEnd = Math.min(1, (index + 2) / total);
              return v >= nextCardEnd ? 1 : 0;
            }),
          }}
        />
      )}
      <div
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
              objectFit: "cover",
              display: "block",
              border: "3px solid #fff",
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
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
            {project.links.map((l) => (
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
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}