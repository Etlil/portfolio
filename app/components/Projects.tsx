"use client";
import { useEffect, useRef, useState } from "react";
import { useMotionValue, useTransform, motion } from "framer-motion";

const projects = [
  {
    number: "01",
    title: "NLAC Student Portal",
    description: "A full-stack student information system built for Northern Luzon Adventist College. Features enrollment management, grade tracking, and an admin dashboard.",
    tech: ["PHP", "Laravel", "MySQL"],
    link: "#",
    repo: "#",
  },
  {
    number: "02",
    title: "Hospital Intern Tracker",
    description: "An internship management system developed during OJT at Northern Luzon Adventist Hospital. Tracks daily tasks, hours rendered, and supervisor feedback.",
    tech: ["Laravel", "JavaScript", "Tailwind CSS"],
    link: "#",
    repo: "#",
  },
  {
    number: "03",
    title: "Inventory Management System",
    description: "A web-based inventory system with real-time stock monitoring, low-stock alerts, and exportable reports for small to mid-sized businesses.",
    tech: ["Angular", "Node.js", "PostgreSQL"],
    link: "#",
    repo: "#",
  },
  {
    number: "04",
    title: "Portfolio Website",
    description: "This portfolio — built from scratch with Next.js, Tailwind CSS, and Lenis. Features smooth scroll animations, parallax effects, and a paper texture theme.",
    tech: ["Next.js", "TypeScript", "Framer Motion"],
    link: "#",
    repo: "#",
  },
  {
    number: "05",
    title: "Barangay Document Request",
    description: "A community web app that allows residents to request barangay documents online, reducing foot traffic and processing time at local government offices.",
    tech: ["PHP", "JavaScript", "MySQL"],
    link: "#",
    repo: "#",
  },
  {
    number: "06",
    title: "E-Commerce Storefront",
    description: "A responsive online store with cart management, product filtering, and PayMongo payment integration tailored for local Philippine sellers.",
    tech: ["React", "Node.js", "MongoDB"],
    link: "#",
    repo: "#",
  },
  {
    number: "07",
    title: "Class Scheduler App",
    description: "An automated class scheduling tool that resolves conflicts, assigns rooms, and generates printable timetables for university departments.",
    tech: ["Angular", "Laravel", "MySQL"],
    link: "#",
    repo: "#",
  },
];

const CARD_W = 280;
const CARD_H = 380;
const STACK_OFFSET_X = 185;
const STACK_OFFSET_Y = 18;

export default function Projects() {
  const sectionRef = useRef<HTMLDivElement>(null);
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
    };

    // Lerp loop — smoothProgress chases scrollProgress at 6% per frame
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

  const totalCards = projects.length;

  return (
    <div
      ref={sectionRef}
      id="projects"
      style={{ height: `${100 + totalCards * 30}vh` }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 3rem",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <p className="text-sm uppercase tracking-widest text-gray-400 mb-2">Work</p>
          <h2 className="text-4xl font-bold text-gray-900">Selected Projects</h2>
        </div>

        {/* Card stack container */}
        <div
          style={{
            position: "relative",
            width: `${CARD_W + STACK_OFFSET_X * (totalCards - 1)}px`,
            height: `${CARD_H + STACK_OFFSET_Y * (totalCards - 1)}px`,
          }}
        >
          {projects.map((p, i) => (
            <ProjectCard
              key={p.number}
              project={p}
              index={i}
              total={totalCards}
              scrollProgress={smoothProgress}
            />
          ))}
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
}: {
  project: (typeof projects)[0];
  index: number;
  total: number;
  scrollProgress: ReturnType<typeof useMotionValue<number>>;
}) {
  const startAt = index / total;
  const endAt = Math.min(1, (index + 1) / total);

  const xFrom = 1920;
  const yFrom = 0;

  const xTo = STACK_OFFSET_X * index;
  const yTo = STACK_OFFSET_Y * index;

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
      <motion.div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: `${STACK_OFFSET_X}px`,
          height: "100%",
          background: "linear-gradient(to left, rgba(0,0,0,0.18), transparent)",
          zIndex: 2,
          pointerEvents: "none",
          opacity: useTransform(scrollProgress, (v) => {
            // Only show shadow after the NEXT card has landed on top
            const nextCardEnd = Math.min(1, (index + 2) / total);
            return v >= nextCardEnd ? 1 : 0;
          }),
        }}
      />
      <div
        style={{
          backgroundColor: "#F5C6AA",
          backgroundImage: "url('/crumple.svg')",
          backgroundRepeat: "repeat",
          backgroundSize: "400px 400px",
          border: "1px solid rgba(0,0,0,0.08)",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          width: `${CARD_W}px`,
          height: `${CARD_H}px`,
          overflow: "hidden",
        }}
      >
        <div className="flex items-start justify-between">
          <span
            style={{
              fontSize: "1.8rem",
              fontWeight: "800",
              color: "rgba(0,0,0,0.12)",
              lineHeight: 1,
            }}
          >
            {project.number}
          </span>
          <div className="flex flex-col gap-1 items-end">
            <a
              href={project.link}
              className="uppercase tracking-widest text-gray-600 underline underline-offset-2 hover:text-gray-900 transition-colors"
              style={{ fontSize: "0.55rem" }}
            >
              Live Demo
            </a>
            <a
              href={project.repo}
              className="uppercase tracking-widest text-gray-600 underline underline-offset-2 hover:text-gray-900 transition-colors"
              style={{ fontSize: "0.55rem" }}
            >
              GitHub
            </a>
          </div>
        </div>

        <h3 className="text-sm font-bold text-gray-900 leading-tight">{project.title}</h3>
        <p className="text-gray-700 leading-relaxed" style={{ fontSize: "0.62rem" }}>
          {project.description}
        </p>

        <div className="flex flex-wrap gap-1 mt-auto">
          {project.tech.map((t) => (
            <span
              key={t}
              className="uppercase tracking-wider text-gray-600 px-1.5 py-0.5"
              style={{ border: "1px solid rgba(0,0,0,0.15)", fontSize: "0.5rem" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}