"use client";
import { useRef, useState, useEffect } from "react";
import { useScroll, useTransform, motion } from "framer-motion";

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
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const slipY = useTransform(scrollYProgress, [0, 1], [-60, 60]);

  const handleMouseMove = (e: React.MouseEvent) => {
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
      className="min-h-screen flex items-center pt-20"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-16 items-center">
        <div>

          <div>
            <p className="text-sm uppercase tracking-widest text-gray-400 mb-3">About Me</p>

            {/* Frame + heading side by side */}
            <div className="flex items-center gap-6 mb-6">
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
                  width: "220px",
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
                    width: "220px",
                    height: "auto",
                    display: "block",
                    zIndex: 1,
                  }}
                />
              </div>

              <div>
                <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-3">
                  I'm Jezreel Pimentel
                </h1>
                <p className="text-xl text-gray-500 font-medium">
                  Web Developer
                </p>
              </div>
            </div>

            <p className="text-gray-600 leading-relaxed mb-8">
              A driven and detail-oriented BSIT graduate with a passion for building real-world web applications from the ground up. Experienced in full-stack development using PHP, Laravel, JavaScript, and Angular, with a proven ability to deliver complete systems from design to deployment.
            </p>
          </div>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
          }}
        >
          {/* All 4 stats in one column inside one frame */}
          <div
            style={{
              position: "absolute",
              top: "5%",
              left: "5%",
              width: "95%",
              height: "95%",
              backgroundColor: "#d4edda",
              backgroundImage: "url('/paper.svg')",
              backgroundRepeat: "repeat",
              backgroundSize: "500px 500px",
              zIndex: 0,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <motion.div
              style={{
                width: "100%",
                display: "grid",
                gridTemplateRows: "repeat(4, auto)",
                alignContent: "center",
                gap: "0.75rem",
                y: slipY,
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
                  backgroundColor: "#d4edda",
                  backgroundImage: "url('/paper.svg')",
                  backgroundRepeat: "repeat",
                  backgroundSize: "500px 500px",
                  display: "flex",
                  marginLeft: "2rem",
                  flexDirection: "column",
                  justifyContent: "center",
                  padding: "0.25rem 0.75rem",
                  minHeight: 0,
                }}
              >
                <p className="text-sm text-gray-700">
                  <span className="text-gray-400 uppercase tracking-wider text-xs mr-2">{stat.label}:</span>
                  {stat.value}
                </p>
                {stat.sub && (
                  <p className="text-sm text-gray-700 ml-4 mt-0.5">{stat.sub}</p>
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