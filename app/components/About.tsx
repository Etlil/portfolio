"use client";
import { useRef, useState, useEffect } from "react";
import { useMotionValue, motion } from "framer-motion";
import SectionSky from "./SectionSky";

export default function About() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [clickIndex, setClickIndex] = useState(-1);

  const clickImages = ["me0.jpg", "me1.jpg", "me2.jpg", "me3.jpg"];
  const isDone = clickIndex === clickImages.length;

  const handleFrameClick = () => {
    if (isDone) return;
    setClickIndex((prev) => prev + 1);
  };

  // clickIndex 0-3 = click images, 4 = done (shows act0.png, locked)

  const currentSrc = isDone || clickIndex < 0
    ? (isDone ? "/act0.png" : hovered ? "/act9.png" : "/act0.png")
    : `/${clickImages[clickIndex]}`;
  const frameRef = useRef<HTMLDivElement>(null);

  const sectionRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const slipY = useMotionValue(0);

  /* The stats slip up and down inside their frame as the section scrolls past.
     The throw used to be a flat ±100px. Inside a 600px desktop panel that is a
     gentle drift; inside the ~310px one a phone gets — where the same text
     wraps onto twice as many lines — it walks half the stats straight out
     through the top of the frame.

     So don't pick a distance: measure the slack. Whatever room is left over
     between the text and the frame is exactly how far the text can travel, and
     spending 80% of it means the effect is as large as it can be at every size
     while still being impossible to overshoot. */
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;
      const progress = 1 - (rect.bottom / (viewH + rect.height));
      const clamped = Math.min(1, Math.max(0, progress));
      const panel = panelRef.current;
      const content = statsRef.current;
      const slack = panel && content ? panel.clientHeight - content.offsetHeight : 0;
      const throwDistance = Math.min(200, Math.max(0, slack) * 0.8);
      slipY.set((0.5 - clamped) * throwDistance);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [slipY]);

  const handleMouseMove = (e: React.MouseEvent) => {
    // A touch "move" fires once, on tap, and leaves the frame stuck at whatever
    // angle the finger landed at — there is no leave event to undo it. Tilt is
    // a mouse affordance; skip it entirely where there is no mouse.
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = (e.clientX - cx) / 30;
    const y = (e.clientY - cy) / 30;
    setTilt({ x, y });
  };

  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    const getGreeting = () => {
      const hour = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        hour12: false,
      });
      const h = parseInt(hour);
      if (h >= 5 && h < 12) return "Good Morning";
      if (h >= 12 && h < 18) return "Good Afternoon";
      if (h >= 18 && h < 22) return "Good Evening";
      return "Good Night";
    };

    setGreeting(getGreeting());
  }, []);

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <section
      ref={sectionRef}
      id="about"
      className="section-screen relative flex items-center"
      style={{ paddingTop: "var(--section-top)" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <SectionSky seed={1} stars={9} />
      <div className="w-full max-w-6xl mx-auto px-5 sm:px-6 py-8 sm:py-12 md:py-24 grid md:grid-cols-2 gap-8 sm:gap-10 md:gap-16 items-center">
        <div>

          <div>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">About Me</p>

            {/* Frame + heading side by side — but only where the column is
                genuinely wide enough for both.

                The direction flips FOUR times on the way up, and every flip is
                a real change in how much room this block has:
                  · phone, one column           → stacked
                  · large phone / small tablet  → side by side (full width)
                  · md, where the page splits into TWO columns → stacked again,
                    because the column just halved and a 220px frame beside the
                    name left about 90px for "I'm Jezreel Pimentel"
                  · xl, where half the page is finally wider than the two of
                    them together → side by side, as drawn. */}
            <div className="flex flex-col sm:flex-row md:flex-col xl:flex-row sm:items-center md:items-start xl:items-center gap-4 sm:gap-6 mb-5 sm:mb-6">
              <div
                ref={frameRef}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={handleFrameClick}
                style={{
                  transform: `perspective(800px) rotateY(${tilt.x}deg) rotateX(${-tilt.y}deg)`,
                  transition: tilt.x === 0 && tilt.y === 0
                    ? "transform 0.6s ease"
                    : "transform 0.1s linear",
                  display: "inline-block",
                  position: "relative",
                  /* Was a flat 220px — more than half the width of a phone, and
                     it forced the heading beside it onto a second line before
                     the layout had even stacked. Grows with the viewport up to
                     the original size and no further. */
                  width: "clamp(132px, 34vw, 220px)",
                  flexShrink: 0,
                  cursor: isDone ? "default" : "pointer",
                }}
              >
                <img
                  src={currentSrc}
                  alt="Jezreel Pimentel"
                  onMouseEnter={() => setHovered(true)}
                  onMouseLeave={() => setHovered(false)}
                  style={{
                    position: "absolute",
                    top: "5%",
                    left: "5%",
                    width: "90%",
                    height: "90%",
                    objectFit: "cover",
                    zIndex: 0,
                  }}
                />
                <img
                  src="/frame.png"
                  alt="Frame"
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "auto",
                    display: "block",
                    zIndex: 1,
                  }}
                />
              </div>

              {/* relative: the sun hangs off the top of this block */}
              <div style={{ position: "relative" }}>
                <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold text-gray-900 leading-tight mb-2 sm:mb-3">
                  I'm Jezreel Pimentel
                </h1>
                <p className="text-lg sm:text-xl text-gray-500 font-medium">
                  Web Developer
                </p>
              </div>
            </div>

            <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-8">
              A driven and detail-oriented BSIT graduate with a passion for building real-world web applications from the ground up. Experienced in full-stack development using PHP, Laravel, JavaScript, and Angular, with a proven ability to deliver complete systems from design to deployment.
            </p>
          </div>
        </div>

        <div
          className="about-panel"
          style={{
            transform: "translateZ(0)",
            willChange: "transform",
          }}
        >
          {/* All 4 stats in one column inside one frame */}
          <div
            ref={panelRef}
            className="paper-panel"
            style={{
              position: "absolute",
              top: "0%",
              left: "0%",
              width: "98%",
              height: "97%",
              backgroundColor: "var(--panel-paper)",
              backgroundImage: "url('/paper.svg')",
              backgroundRepeat: "repeat",
              backgroundSize: "300px 300px",
              zIndex: 0,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <motion.div
              ref={statsRef}
              layout={false}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateRows: "repeat(4, auto)",
                alignContent: "center",
                gap: "clamp(0.35rem, 1.5vw, 0.75rem)",
                y: slipY,
                willChange: "transform",
              }}
            >
            {[
              { label: "Contact", value: "09310623693" },
              { label: "Email", value: "jezreelpimentel@gmail.com" },
              { label: "School", value: "Northern Luzon Adventist College (BSIT Graduate)" },
              { label: "Work Experience", value: "", sub: "Northern Luzon Adventist Hospital – Intern" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  /* Was a flat 2rem, which is a fifth of the panel's width once
                     the panel is only as wide as a phone. Proportional, so the
                     text keeps the same visual inset from the torn frame at
                     every size. */
                  marginLeft: "clamp(0.5rem, 6%, 2rem)",
                  marginRight: "clamp(0.25rem, 3%, 1rem)",
                  flexDirection: "column",
                  justifyContent: "center",
                  padding: "0.25rem 0.75rem",
                  minHeight: 0,
                }}
              >
                <p className="text-xs sm:text-sm text-gray-700" style={{ overflowWrap: "anywhere" }}>
                  <span className="text-gray-400 uppercase tracking-wider text-[0.65rem] sm:text-xs mr-2">{stat.label}:</span>
                  {stat.value}
                </p>
                {stat.sub && (
                  <p className="text-xs sm:text-sm text-gray-700 ml-3 sm:ml-4 mt-0.5">{stat.sub}</p>
                )}
              </div>
            ))}
          </motion.div>
          </div>

          {/* Single frame overlay */}
          <img
            src="/frame2.png"
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "fill",
              zIndex: 1,
            }}
          />
        </div>
      </div>
    </section>
  );
}