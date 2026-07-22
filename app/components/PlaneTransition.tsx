"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

// Phaser touches window/document at import time, so it must never be
// imported on the server. GameCanvas itself also does a dynamic
// `await import("phaser")` internally, but wrapping the component too
// means Next won't even try to SSR it.
const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

const DISPLAY_SIZE = 200;
const SECTION_HEIGHT = 180;
const PLANE_START_X = 10;
const SCROLL_DISTANCE_FACTOR = 1;
const FLIGHT_START_OFFSET = 1;
const TRAIL_CHAR = "—";
const TRAIL_SPACING = 40;
const MAX_TRAILS = 20;
const TRAIL_FONT_SIZE = 24;
const TRAIL_WIGGLE_AMPLITUDE = 6;
const TRAIL_WIGGLE_DURATION = 1.4;

const MANEUVER_WAVE_AMPLITUDE = 34;
const MANEUVER_WAVE_CYCLES = 3;
const MANEUVER_STEPS_PER_SCROLL = 24;

const FLIP_COLS = 3;
const FLIP_ROWS = 3;
const FLIP_FRAMES = FLIP_COLS * FLIP_ROWS;
const FLIP_FRAME_ANGLE = 360 / FLIP_FRAMES;

const FLIP_SKIP_FRAMES = 3;
const FLIP_USABLE_COUNT = FLIP_FRAMES - FLIP_SKIP_FRAMES;
const FLIP_PINGPONG_PERIOD = (FLIP_USABLE_COUNT - 1) * 2;

function pingPongFlipFrame(step: number): number {
  let m = Math.round(step) % FLIP_PINGPONG_PERIOD;
  if (m < 0) m += FLIP_PINGPONG_PERIOD;
  const offset = m <= FLIP_USABLE_COUNT - 1 ? m : FLIP_PINGPONG_PERIOD - m;
  return FLIP_SKIP_FRAMES + offset;
}

function angleToRestrictedFrame(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  const step = Math.round(a / (360 / FLIP_USABLE_COUNT)) % FLIP_USABLE_COUNT;
  return FLIP_SKIP_FRAMES + step;
}

const PLANE_GAME_SIZE = 160;

// ── LOOP-THE-LOOP FLIGHT PATH ──────────────────────────
const LIFTOFF_DURATION = 400;         // ← ms for the liftoff curve (PATH_LP0 → PATH_LP3), independent of the loop
const LOOP_DURATION = 2400;           // ← ms for ONLY the circular loop segment — edit this alone to change loop speed
const APPROACH_DURATION = 700;        // ← ms for the approach curve into the gameframe destination
const GAME_FRAME_SLIDE_DURATION = 3000;
const MAIN_CONTENT_SLIDE_DURATION = 3000;
const PATH_LP0 = { x: 0, y: 0 };
const PATH_LP1 = { x: 18, y: -50 };
const PATH_LP2 = { x: -2, y: -95 };
const PATH_LP3 = { x: 8, y: -125 };
const PATH_LOOP_RADIUS = 58;
const PATH_LOOP_SWEEP_DEG = -360;
const PATH_LOCAL_END = { x: 175, y: -245 };
const PATH_APPROACH_HANDLE = 70;
const PATH_APPROACH_P2_OFFSET = { x: -15, y: 10 };
const TOTAL_FLIGHT_DURATION = LIFTOFF_DURATION + LOOP_DURATION + APPROACH_DURATION;
const RETURN_FLIGHT_DURATION = 3000; // Increase this number to make it slower (e.g., 5000 = 5 seconds)
const PATH_LIFT_FRAC = LIFTOFF_DURATION / TOTAL_FLIGHT_DURATION;     // ← time budget: liftoff (derived)
const PATH_LOOP_FRAC = LOOP_DURATION / TOTAL_FLIGHT_DURATION;        // ← time budget: loop (derived)
const PATH_APPROACH_FRAC = APPROACH_DURATION / TOTAL_FLIGHT_DURATION; // ← time budget: approach (derived)

interface Trail { id: number; x: number; seed: number; createdAt: number; }

type Phase = "idle" | "flipping" | "arrived" | "returning";
type Vec = { x: number; y: number };

const v = {
  sub: (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y }),
  add: (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y }),
  scale: (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s }),
  len: (a: Vec) => Math.hypot(a.x, a.y),
  normalize: (a: Vec): Vec => {
    const l = Math.hypot(a.x, a.y) || 1;
    return { x: a.x / l, y: a.y / l };
  },
  leftNormal: (d: Vec): Vec => ({ x: d.y, y: -d.x }),
  angleOf: (a: Vec) => Math.atan2(a.y, a.x),
};

function cubicPoint(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}
function cubicTangent(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const mt = 1 - t;
  const a = 3 * mt * mt, b = 6 * mt * t, c = 3 * t * t;
  return {
    x: a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x),
    y: a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y),
  };
}

const PATH_ENTRY_DIR = v.normalize(v.sub(PATH_LP3, PATH_LP2));
const PATH_LOOP_CENTER = v.add(PATH_LP3, v.scale(v.leftNormal(PATH_ENTRY_DIR), PATH_LOOP_RADIUS));
const PATH_THETA_ENTRY = v.angleOf(v.sub(PATH_LP3, PATH_LOOP_CENTER));
const PATH_LOOP_SWEEP_RAD = (PATH_LOOP_SWEEP_DEG * Math.PI) / 180;
const PATH_THETA_EXIT = PATH_THETA_ENTRY + PATH_LOOP_SWEEP_RAD;
const PATH_TANGENT_SIGN = Math.sign(PATH_LOOP_SWEEP_RAD);
const PATH_LOOP_EXIT: Vec = {
  x: PATH_LOOP_CENTER.x + PATH_LOOP_RADIUS * Math.cos(PATH_THETA_EXIT),
  y: PATH_LOOP_CENTER.y + PATH_LOOP_RADIUS * Math.sin(PATH_THETA_EXIT),
};
const PATH_EXIT_TANGENT = v.normalize({
  x: -Math.sin(PATH_THETA_EXIT) * PATH_TANGENT_SIGN,
  y: Math.cos(PATH_THETA_EXIT) * PATH_TANGENT_SIGN,
});
const PATH_APP_P0 = PATH_LOOP_EXIT;
const PATH_APP_P1 = v.add(PATH_LOOP_EXIT, v.scale(PATH_EXIT_TANGENT, PATH_APPROACH_HANDLE));
const PATH_OVERALL_DIR = v.normalize(v.sub(PATH_LOCAL_END, PATH_LP0));
const PATH_APP_P3 = PATH_LOCAL_END;
const PATH_APP_P2 = v.add(v.sub(PATH_LOCAL_END, v.scale(PATH_OVERALL_DIR, PATH_APPROACH_HANDLE)), PATH_APPROACH_P2_OFFSET);
const PATH_LOOP_HALF_TURN = PATH_TANGENT_SIGN > 0 ? Math.PI / 2 : -Math.PI / 2;

function samplePath(s: number): { pt: Vec; angle: number } {
  s = Math.min(1, Math.max(0, s));
  if (s <= PATH_LIFT_FRAC) {
    const t = s / PATH_LIFT_FRAC;
    return {
      pt: cubicPoint(PATH_LP0, PATH_LP1, PATH_LP2, PATH_LP3, t),
      angle: v.angleOf(cubicTangent(PATH_LP0, PATH_LP1, PATH_LP2, PATH_LP3, t)),
    };
  }
  if (s <= PATH_LIFT_FRAC + PATH_LOOP_FRAC) {
    const t = (s - PATH_LIFT_FRAC) / PATH_LOOP_FRAC;
    const theta = PATH_THETA_ENTRY + t * PATH_LOOP_SWEEP_RAD;
    return {
      pt: { x: PATH_LOOP_CENTER.x + PATH_LOOP_RADIUS * Math.cos(theta), y: PATH_LOOP_CENTER.y + PATH_LOOP_RADIUS * Math.sin(theta) },
      angle: theta + PATH_LOOP_HALF_TURN,
    };
  }
  const t = (s - PATH_LIFT_FRAC - PATH_LOOP_FRAC) / PATH_APPROACH_FRAC;
  const pt = cubicPoint(PATH_APP_P0, PATH_APP_P1, PATH_APP_P2, PATH_APP_P3, t);
  const tanNow = v.angleOf(cubicTangent(PATH_APP_P0, PATH_APP_P1, PATH_APP_P2, PATH_APP_P3, t));
  const tanStart = v.angleOf(cubicTangent(PATH_APP_P0, PATH_APP_P1, PATH_APP_P2, PATH_APP_P3, 0));
  let delta = tanNow - tanStart;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const loopExitAngle = PATH_THETA_EXIT + PATH_LOOP_HALF_TURN;
  return { pt, angle: loopExitAngle + delta };
}

function buildFlightTransform(actualStart: Vec, actualEnd: Vec) {
  const localVec = v.sub(PATH_LOCAL_END, PATH_LP0);
  const actualVec = v.sub(actualEnd, actualStart);
  const scaleFactor = v.len(actualVec) / (v.len(localVec) || 1);
  const rotation = v.angleOf(actualVec) - v.angleOf(localVec);
  const cosR = Math.cos(rotation), sinR = Math.sin(rotation);
  return (p: Vec): Vec => {
    const rel = v.sub(p, PATH_LP0);
    const rx = rel.x * cosR - rel.y * sinR;
    const ry = rel.x * sinR + rel.y * cosR;
    return { x: actualStart.x + rx * scaleFactor, y: actualStart.y + ry * scaleFactor };
  };
}

function easeLenis(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export default function PlaneTransition() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const planeImgRef = useRef<HTMLDivElement>(null);

  const [planeX, setPlaneX] = useState(-DISPLAY_SIZE);
  const [planeYOffset, setPlaneYOffset] = useState(0);
  const [trails, setTrails] = useState<Trail[]>([]);
  const trailIdRef = useRef(0);
  const lastTrailX = useRef(-9999);
  const lastScrollY = useRef<number | null>(null);
  const wasVisible = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [flipFrame, setFlipFrame] = useState(0);

  const [tweenX, setTweenX] = useState(0);
  const [tweenY, setTweenY] = useState(0);
  const [tweenScale, setTweenScale] = useState(1);
  const [tweenRotate, setTweenRotate] = useState(0);
  const [tweenVisible, setTweenVisible] = useState(false);

  const [gameFrameSlide, setGameFrameSlide] = useState(0);
  const [planeReady, setPlaneReady] = useState(false);
  const [phaserReady, setPhaserReady] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFrameOffscreen, setGameFrameOffscreen] = useState(true);

  // Measured pixel size of #game-area, passed straight into Phaser's
  // canvas. Phaser wants concrete numbers, not the % values the div uses
  // for its own CSS layout.
  const [gameAreaSize, setGameAreaSize] = useState({ width: 0, height: 0 });

  const frozenX = useRef(0);
  const frozenY = useRef(0);
  const tweenRafRef = useRef<number | null>(null);
  const frameWrapperRef = useRef<HTMLDivElement>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  // ── SCROLL ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== "idle") return;
    const section = sectionRef.current;
    if (!section) return;

    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const viewH = window.innerHeight;
      const visible = rect.top < viewH && rect.bottom > 0;

      if (visible && !wasVisible.current) {
        lastTrailX.current = -9999;
        trailIdRef.current = 0;
        setTrails([]);
        setPlaneX(PLANE_START_X);
      }
      wasVisible.current = visible;

      if (!visible) { lastScrollY.current = null; return; }
      if (lastScrollY.current === null) { lastScrollY.current = window.scrollY; return; }

      const scrollDelta = window.scrollY - lastScrollY.current;
      lastScrollY.current = window.scrollY;

      const totalTravel = viewH + section.offsetHeight;
      const rawProgress = (viewH - rect.top) / totalTravel;
      const prog = Math.min(1, Math.max(0,
        (rawProgress - FLIGHT_START_OFFSET * 0.1) / SCROLL_DISTANCE_FACTOR
      ));

      const newX = PLANE_START_X + prog * (window.innerWidth + DISPLAY_SIZE * 2);
      setPlaneX(newX);

      const flipStep = prog * MANEUVER_STEPS_PER_SCROLL;
      setFlipFrame(pingPongFlipFrame(flipStep));

      const wave = Math.sin(prog * Math.PI * 2 * MANEUVER_WAVE_CYCLES) * MANEUVER_WAVE_AMPLITUDE;
      setPlaneYOffset(wave);

      if (scrollDelta > 0) {
        if (lastTrailX.current >= newX) lastTrailX.current = newX - TRAIL_SPACING;
        const newTrails: Trail[] = [];
        let nextX = lastTrailX.current + TRAIL_SPACING;
        while (nextX <= newX - TRAIL_SPACING) {
          newTrails.push({ id: trailIdRef.current++, x: nextX, seed: Math.random(), createdAt: Date.now() });
          nextX += TRAIL_SPACING;
        }
        if (newTrails.length > 0) {
          lastTrailX.current = newTrails[newTrails.length - 1].x;
          setTrails((prev) => [...prev, ...newTrails].slice(-MAX_TRAILS));
        }
      } else {
        setTrails((prev) => prev.slice(0, -1).filter((t) => t.x < newX));
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [phase]);

  // ── TRAIL CLEANUP ──
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTrails(prev => prev.filter(t => now - t.createdAt < 1000));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // ── MEASURE #game-area FOR PHASER ─────────────────────
  // Only needs to run once the frame has actually arrived and settled,
  // since that's the only time Phaser is mounted. A ResizeObserver keeps
  // it correct across window resizes too.
  useEffect(() => {
    if (phase !== "arrived") return;
    const el = gameAreaRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setGameAreaSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  // ── CLICK ────────────────────────────────────────────
  const handlePlaneClick = useCallback(() => {
    if (phase !== "idle") return;

    const img = planeImgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    frozenX.current = rect.left;
    frozenY.current = rect.top;

    setTweenX(rect.left);
    setTweenY(rect.top);
    setTweenScale(1);
    setTweenRotate(0);
    setFlipFrame(0);

    setTweenVisible(true);
    setPhase("flipping");
    setPhaserReady(false);

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const lenis = (window as any).__lenis;
    if (lenis) lenis.stop();

    document.body.style.setProperty("--main-content-duration", `${MAIN_CONTENT_SLIDE_DURATION}ms`);
    document.body.classList.add("game-active");

    setGameFrameSlide(window.innerWidth);
    setGameFrameOffscreen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setGameFrameSlide(0);
        setGameFrameOffscreen(false);
      });
    });
  }, [phase]);

  // ── FLIP TWEEN (loop-the-loop flight) ─────────────────
  useEffect(() => {
    if (phase !== "flipping") return;

    const centerStart: Vec = {
      x: frozenX.current + DISPLAY_SIZE / 2,
      y: frozenY.current + DISPLAY_SIZE / 2,
    };
    // Measure the REAL gameframe destination up front, correcting for the
    // frame's current slide-in transform, so the loop path's own end point
    // lands exactly where the plane needs to be — this removes the need
    // for a separate "fly into place" tween after the loop, which was the
    // source of the twitch (its start point never quite matched where the
    // loop actually ended).
    const targetScale = PLANE_GAME_SIZE / DISPLAY_SIZE;

    // Re-measured every frame — not just once — so the destination always
    // matches the gameframe's REAL current rest position, even if the
    // slide-in transform, scrollbar removal, or layout settling shifts
    // things right after the click. This is what removes the teleport:
    // the tween's own final frame IS the real position, not a one-time
    // estimate taken before everything had settled.
    const measureCenterEnd = (): Vec => {
      const gameAreaEl = document.getElementById("game-area");
      const wrapperEl = frameWrapperRef.current;
      if (gameAreaEl && wrapperEl) {
        const liveRect = gameAreaEl.getBoundingClientRect();
        const matrix = new DOMMatrixReadOnly(window.getComputedStyle(wrapperEl).transform);
        const liveTranslateX = matrix.m41;
        const restLeft = liveRect.left - liveTranslateX;
        const restTop = liveRect.top;
        return {
          x: restLeft + 50 + PLANE_GAME_SIZE / 2,
          y: restTop + 150 + PLANE_GAME_SIZE / 2,
        };
      }
      // Fallback only used on the rare chance game-area isn't mounted yet.
      return {
        x: window.innerWidth * 0.29 + (DISPLAY_SIZE * targetScale) / 2,
        y: window.innerHeight / 2 - DISPLAY_SIZE / 1.7 + (DISPLAY_SIZE * targetScale) / 2,
      };
    };

    const baselineAngle = samplePath(0).angle;
    const startTime = performance.now();
    const totalDuration = TOTAL_FLIGHT_DURATION;

    const loop = (now: number) => {
      const rawP = Math.min(1, (now - startTime) / totalDuration);
      const s = easeLenis(rawP);

      const centerEnd = measureCenterEnd();
      const toScreen = buildFlightTransform(centerStart, centerEnd);

      const { pt, angle } = samplePath(s);
      const screenPt = toScreen(pt);
      const curScale = 1 + (targetScale - 1) * s;
      const rotationDeg = ((angle - baselineAngle) * 180) / Math.PI;

      setTweenX(screenPt.x - DISPLAY_SIZE / 2);
      setTweenY(screenPt.y - DISPLAY_SIZE / 2);
      setTweenScale(curScale);
      setTweenRotate(0);
      setFlipFrame(angleToRestrictedFrame(rotationDeg));

      if (rawP < 1) {
        tweenRafRef.current = requestAnimationFrame(loop);
      } else {
        // ANIMATION FINISHED: Clean up state immediately
        setTweenVisible(false);
        setTweenRotate(0);
        setPlaneReady(true);
        setPhase("arrived");
        
      }
    };

    tweenRafRef.current = requestAnimationFrame(loop);

    return () => {
      if (tweenRafRef.current) cancelAnimationFrame(tweenRafRef.current);
    };
  }, [phase]);

  // ── RETURN TWEEN (reverse loop-the-loop flight) ───────
  useEffect(() => {
    if (phase !== "returning") return;

    const gameAreaEl = document.getElementById("game-area");
    const startRect = gameAreaEl ? gameAreaEl.getBoundingClientRect() : { left: 0, top: 0 };
    const centerStart: Vec = { x: startRect.left + 50 + PLANE_GAME_SIZE / 2, y: startRect.top + 150 + PLANE_GAME_SIZE / 2 };
    const centerEnd: Vec = { x: frozenX.current + DISPLAY_SIZE / 2, y: frozenY.current + DISPLAY_SIZE / 2 };
    const toScreen = buildFlightTransform(centerEnd, centerStart);
    const baselineAngle = samplePath(0).angle;
    const targetScale = PLANE_GAME_SIZE / DISPLAY_SIZE;
    const startTime = performance.now();

    setTweenX(centerStart.x - DISPLAY_SIZE / 2);
    setTweenY(centerStart.y - DISPLAY_SIZE / 2);
    setTweenScale(targetScale);
    setTweenVisible(true);

    const loop = (now: number) => {
      const rawP = Math.min(1, (now - startTime) / RETURN_FLIGHT_DURATION);
      const s = 1 - easeLenis(rawP);

      const { pt, angle } = samplePath(s);
      const screenPt = toScreen(pt);
      setTweenX(screenPt.x - DISPLAY_SIZE / 2);
      setTweenY(screenPt.y - DISPLAY_SIZE / 2);
      setTweenScale(1 + (targetScale - 1) * s);
      // This tilts the nose UP (-90) and does a 360 spin at the same time
      // Math.min(1, rawP * 3) makes the rotation finish in the first 33% of the flight
      // Changing 3 to 1.5 makes the flip take twice as long as before
      const rotationProgress = Math.min(1, rawP * 1.5);
      setTweenRotate(360 * rotationProgress);
      // Force the sprite frame to 0 at the very end to match the idle plane
      if (rawP >= 1) setFlipFrame(0);
      // +180 turns the nose to face left, +(rawP * 360) performs the 360-degree flip
      const returnRotation = ((angle - baselineAngle) * 180) / Math.PI + 180 + (rawP * 360);
      setFlipFrame(angleToRestrictedFrame(returnRotation));

      if (rawP < 1) {
        tweenRafRef.current = requestAnimationFrame(loop);
      } else {
        // ANIMATION FINISHED: Return to normal scrolling state
        setTweenVisible(false);
        setTweenRotate(0);
        setPhase("idle"); 

        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
        const lenis = (window as any).__lenis;
        if (lenis) lenis.start();
        document.body.classList.remove("game-returning");
        setTrails([]);
      }
    };

    tweenRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (tweenRafRef.current) cancelAnimationFrame(tweenRafRef.current);
      setTweenVisible(false);
    };
  }, [phase]);

  const handleReturn = useCallback(() => {
    if (phase !== "arrived") return;
    setPhase("returning");
    setPlaneReady(false);
    setGameFrameSlide(window.innerWidth);
    document.body.style.setProperty("--main-content-duration", `${MAIN_CONTENT_SLIDE_DURATION}ms`);
    document.body.classList.remove("game-active");
    document.body.classList.add("game-returning");

    // We removed the setTimeout here because the Tween loop below will handle the exit
  }, [phase]);
  const flipCol = flipFrame % FLIP_COLS;
  const flipRow = Math.floor(flipFrame / FLIP_COLS);

  return (
    <>
      {/* ── SCROLL SECTION ── */}
      <div ref={sectionRef} style={{
        position: "relative",
        height: `${SECTION_HEIGHT}px`,
        width: "100%",
        overflow: "hidden",
      }}>
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <filter id="pencilTexture" x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>
        <style>{`
          @keyframes planeTrailWiggle {
            0%, 100% { transform: translateY(calc(-50% - ${TRAIL_WIGGLE_AMPLITUDE}px)); }
            50% { transform: translateY(calc(-50% + ${TRAIL_WIGGLE_AMPLITUDE}px)); }
          }
        `}</style>
        {trails.map((trail) => (
          <span key={trail.id} style={{
            position: "absolute", top: "50%",
            left: trail.x, fontSize: `${TRAIL_FONT_SIZE}px`,
            color: "rgba(0,0,0,0.35)", fontWeight: "bold",
            lineHeight: 1, pointerEvents: "none", userSelect: "none",
            animation: `planeTrailWiggle ${TRAIL_WIGGLE_DURATION * (0.7 + trail.seed * 0.6)}s ease-in-out infinite`,
            animationDelay: `${-trail.seed * TRAIL_WIGGLE_DURATION}s`,
            filter: "url(#pencilTexture)",
            textShadow: "0.5px 0.5px 0 rgba(0,0,0,0.15), -0.5px 0px 0 rgba(0,0,0,0.1)",
          }}>{TRAIL_CHAR}</span>
        ))}

        {phase === "idle" && (
          <div
            ref={planeImgRef as unknown as React.RefObject<HTMLDivElement>}
            onClick={handlePlaneClick}
            style={{
              position: "absolute",
              top: `calc(50% + ${planeYOffset}px)`,
              transform: "translateY(-50%)",
              left: planeX,
              width: DISPLAY_SIZE, height: DISPLAY_SIZE,
              cursor: "pointer", imageRendering: "pixelated",
              backgroundImage: "url('/flip.png')",
              backgroundSize: `${FLIP_COLS * 100}% ${FLIP_ROWS * 100}%`,
              backgroundPosition: `${(flipFrame % FLIP_COLS) * (100 / (FLIP_COLS - 1))}% ${Math.floor(flipFrame / FLIP_COLS) * (100 / (FLIP_ROWS - 1))}%`,
            }}
          />
        )}
      </div>

      {/* ── TWEEN PLANE ── */}
      {tweenVisible && typeof document !== "undefined" && createPortal(
        <div style={{
          position: "fixed",
          left: tweenX,
          top: tweenY,
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE,
          zIndex: 9999,
          pointerEvents: "none",
          transform: `scale(${tweenScale}) rotate(${tweenRotate}deg)`,
          transformOrigin: "50% 50%",
        }}>
          <div style={{
            width: "100%", height: "100%",
            backgroundImage: "url('/flip.png')",
            backgroundSize: `${FLIP_COLS * 100}% ${FLIP_ROWS * 100}%`,
            backgroundPosition: `${flipCol * (100 / (FLIP_COLS - 1))}% ${flipRow * (100 / (FLIP_ROWS - 1))}%`,
            imageRendering: "pixelated",
          }} />
        </div>,
        document.body
      )}

      {/* ── GAME FRAME OVERLAY ── */}
      {(phase === "flipping" || phase === "arrived" || phase === "returning") &&
       typeof document !== "undefined" && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "transparent",
          pointerEvents: phase === "flipping" ? "none" : "auto",
        }}>
          <div ref={frameWrapperRef} style={{
            transform: `translateX(${gameFrameSlide}px)`,
            transition: gameFrameOffscreen ? "none" : `transform ${GAME_FRAME_SLIDE_DURATION / 1000}s ease-in-out`,
            position: "relative",
            display: "inline-block",
          }}>
            <img
              src="/gameframe.png"
              alt="frame"
              style={{
                display: "block", imageRendering: "pixelated",
                pointerEvents: "none", position: "relative",
                zIndex: 3, maxHeight: "80vh", width: "auto",
              }}
            />

            <div
              id="game-area"
              ref={gameAreaRef}
              onClick={phase === "arrived" ? undefined : handleReturn}
              style={{
                position: "absolute",
                top: "5%", left: "3%", right: "3%", bottom: "5%",
                overflow: "hidden", zIndex: 2,
                cursor: "default",
              }}
            >
              {/* CSS sprite plane: shown during the flight handoff, before
                  Phaser has booted. Once Phaser mounts (phase === "arrived"
                  && gameAreaSize is measured) this fades out and the canvas
                  takes over — the "back" control lives inside the Phaser
                  scene from that point on. */}
              <div style={{
                position: "absolute", left: 50, top: 150,
                width: PLANE_GAME_SIZE, height: PLANE_GAME_SIZE,
                imageRendering: "pixelated",
                pointerEvents: "none", zIndex: 2,
                backgroundImage: "url('/flip.png')",
                backgroundSize: `${FLIP_COLS * 100}% ${FLIP_ROWS * 100}%`,
                backgroundPosition: `${flipCol * (100 / (FLIP_COLS - 1))}% ${flipRow * (100 / (FLIP_ROWS - 1))}%`,
                transform: `rotate(${tweenRotate}deg)`, 
                opacity: planeReady && phase === "arrived" && gameAreaSize.width > 0 ? 0 : (planeReady ? 1 : 0),
                transition: "opacity 1ms linear",
              }} />

              {phase === "arrived" && gameAreaSize.width > 0 && (
                <div style={{ position: "absolute", inset: 0, zIndex: 3 }}>
                  <GameCanvas
                    width={gameAreaSize.width}
                    height={gameAreaSize.height}
                    startFrame={flipFrame}
                    onExit={handleReturn}
                    onReady={() => setPhaserReady(true)}
                    onStart={() => setGameStarted(true)} 
                  />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}