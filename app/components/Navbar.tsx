"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const LINKS = ["About", "Projects", "Skills", "Contact"];

/* useLayoutEffect is the right hook here — the header height has to be in place
   before anything paints against it — but React warns when it runs during
   server rendering, where there is no layout to read. Fall back to useEffect on
   the server, where the body never runs anyway. */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  // The header's real height, kept out of React state on purpose: it is read
  // inside the click handler and written straight to a CSS variable, so
  // re-rendering on every resize would buy nothing.
  const heightRef = useRef(132);
  // Read inside the observer, which is set up once and must not re-subscribe
  // every time the menu is toggled.
  const openRef = useRef(false);
  openRef.current = open;

  /* ── PUBLISH THE HEADER'S HEIGHT ──
     Every section below has to start below this bar, and the bar is not one
     height: it shrinks with the breakpoint, again with the root font scale, and
     it doubles when the mobile menu opens. Measuring it and writing it to
     `--header-h` means no section ever has to guess — `--section-top` in
     globals.css is derived from this and used everywhere.

     useLayoutEffect so the value is in place before the first paint; a
     ResizeObserver keeps it right through rotation, font loading and the menu
     opening. */
  useIsoLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const publish = () => {
      /* Only ever the CLOSED height. An open menu makes the header two or three
         times taller, and publishing that would shove every section on the page
         down for as long as the menu is up — the content would visibly jump
         out from under the reader while they pick a link. The menu is an
         overlay; the layout underneath should not know it exists. */
      if (openRef.current) return;
      // The torn edge is a ragged PNG whose bottom pixels are transparent, so
      // the visually "solid" header ends a little above its box. Backing off a
      // third of the tear lets content sit snugly under the rip instead of
      // leaving a band of empty paper below it.
      const tear = el.querySelector(".nav-tear-wrap") as HTMLElement | null;
      const slack = tear ? tear.offsetHeight * 0.34 : 0;
      const h = Math.round(el.offsetHeight - slack);
      if (h === heightRef.current) return;
      heightRef.current = h;
      document.documentElement.style.setProperty("--header-h", `${h}px`);
    };

    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener("orientationchange", publish);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", publish);
    };
  }, []);

  /* The menu is a fixed overlay, so scrolling the page behind it while it is
     open just slides the content out from under the links. Lock the page for as
     long as it is up — and let Lenis go, or it keeps driving the scroll it no
     longer owns. */
  useEffect(() => {
    if (!open) return;
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    lenis?.stop();
    return () => lenis?.start();
  }, [open]);

  // Smooth-scroll to a section through Lenis (same feel as the rest of the
  // site), with a native fallback. The offset is the header's own measured
  // height, so the target always lands just under the torn edge at every
  // breakpoint instead of under a hard-coded 90px.
  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setOpen(false);
    const target = document.getElementById(id);
    if (!target) return;
    // The published height is the closed one, which is exactly what we want:
    // the menu is closing on this very click, so aim at where the header is
    // about to be rather than at its momentarily expanded self.
    const offset = -heightRef.current - 8;
    const lenis = (window as unknown as {
      __lenis?: {
        start: () => void;
        scrollTo: (t: Element, o?: { offset?: number; duration?: number }) => void;
      };
    }).__lenis;
    if (lenis) {
      /* Restart Lenis BEFORE asking it to scroll. While the mobile menu is open
         it is stopped (so the page can't slide out from under the links), and a
         stopped Lenis quietly ignores scrollTo. The `setOpen(false)` above will
         restart it too — but only after React has re-rendered, which is several
         milliseconds after this line, so on a phone every menu link did
         nothing at all. */
      lenis.start();
      lenis.scrollTo(target, { offset, duration: 1.2 });
    } else {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header ref={headerRef} className="fixed top-0 w-full z-[9999] flex flex-col">
      <nav
        className="px-4 sm:px-6 pt-1 pb-2 sm:pb-4 relative z-10"
        style={{ backgroundColor: "var(--nav-paper)" }}
      >
        <div className="max-w-6xl mx-auto w-full flex justify-between items-center mt-2 sm:mt-4">
          <a
            href="#about"
            onClick={(e) => go(e, "about")}
            className="text-base sm:text-lg font-bold tracking-tight text-gray-900"
          >
            ETLIL
          </a>

          {/* Desktop links */}
          <ul className="hidden md:flex gap-6 lg:gap-8 text-sm font-medium text-gray-600 uppercase tracking-widest">
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

          {/* Mobile hamburger — 44px square, the smallest reliable touch target */}
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="md:hidden flex flex-col justify-center items-center gap-1.5 w-11 h-11 -mr-2"
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
          <ul className="nav-mobile-menu md:hidden mt-3 flex flex-col gap-1 text-sm font-medium text-gray-700 uppercase tracking-widest max-w-6xl mx-auto w-full">
            {LINKS.map((s) => (
              <li key={s}>
                <a
                  href={`#${s.toLowerCase()}`}
                  onClick={(e) => go(e, s.toLowerCase())}
                  className="block py-3 hover:text-gray-900 transition-colors"
                >
                  {s}
                </a>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Ripped paper edge — height is per-breakpoint, see .nav-tear-wrap */}
      <div className="nav-tear-wrap w-full relative z-0">
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
