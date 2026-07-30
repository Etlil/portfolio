"use client";
import { useState } from "react";

const LINKS = ["About", "Projects", "Skills", "Contact"];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // Smooth-scroll to a section through Lenis (same feel as the rest of the
  // site), with a native fallback. The offset keeps the target clear of the
  // fixed header.
  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setOpen(false);
    const target = document.getElementById(id);
    if (!target) return;
    const lenis = (window as unknown as {
      __lenis?: { scrollTo: (t: Element, o?: { offset?: number; duration?: number }) => void };
    }).__lenis;
    if (lenis) lenis.scrollTo(target, { offset: -90, duration: 1.2 });
    else target.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="fixed top-0 w-full z-[9999] flex flex-col">
      <nav className="px-6 pt-1 pb-4 relative z-10" style={{ backgroundColor: "var(--nav-paper)" }}>
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center mt-4">
          <a
            href="#about"
            onClick={(e) => go(e, "about")}
            className="text-lg font-bold tracking-tight text-gray-900"
          >
            ETLIL
          </a>

          {/* Desktop links */}
          <ul className="hidden md:flex gap-8 text-sm font-medium text-gray-600 uppercase tracking-widest">
            {LINKS.map((s) => (
              <li key={s}>
                <a
                  href={`#${s.toLowerCase()}`}
                  onClick={(e) => go(e, s.toLowerCase())}
                  className="hover:text-gray-900 transition-colors"
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="md:hidden flex flex-col justify-center items-center gap-1.5 w-9 h-9"
          >
            <span
              className="block h-0.5 w-6 bg-gray-900"
              style={{ transition: "transform 0.25s ease", transform: open ? "translateY(8px) rotate(45deg)" : "none" }}
            />
            <span
              className="block h-0.5 w-6 bg-gray-900"
              style={{ transition: "opacity 0.2s ease", opacity: open ? 0 : 1 }}
            />
            <span
              className="block h-0.5 w-6 bg-gray-900"
              style={{ transition: "transform 0.25s ease", transform: open ? "translateY(-8px) rotate(-45deg)" : "none" }}
            />
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <ul className="md:hidden mt-4 flex flex-col gap-1 text-sm font-medium text-gray-700 uppercase tracking-widest max-w-6xl mx-auto w-full">
            {LINKS.map((s) => (
              <li key={s}>
                <a
                  href={`#${s.toLowerCase()}`}
                  onClick={(e) => go(e, s.toLowerCase())}
                  className="block py-2 hover:text-gray-900 transition-colors"
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Ripped paper edge */}
      <div className="nav-tear-wrap w-full relative z-0" style={{ height: "60px", marginTop: "-10px" }}>
        <img
          src="/ripped.png"
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "fill",
            display: "block",
          }}
        />
      </div>
    </header>
  );
}
