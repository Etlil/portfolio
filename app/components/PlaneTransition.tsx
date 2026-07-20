"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

const DISPLAY_SIZE = 200;
const SECTION_HEIGHT = 180;
const PLANE_START_X = 10;
const SCROLL_DISTANCE_FACTOR = 1;
const FLIGHT_START_OFFSET = 1;
const TRAIL_CHAR = "—";
const TRAIL_SPACING = 40;
const MAX_TRAILS = 20;
const TRAIL_FONT_SIZE = 24;
const TRAIL_WIGGLE_AMPLITUDE = 6;   // ← px of vertical bob per trail dash
const TRAIL_WIGGLE_DURATION = 1.4;  // ← base seconds per bob cycle (randomized ±30% per dash)

const MANEUVER_WAVE_AMPLITUDE = 34;  // ← px of vertical bob
const MANEUVER_WAVE_CYCLES = 3;      // ← how many up/down waves across the flight
const MANEUVER_STEPS_PER_SCROLL = 24; // ← how many ping-pong flip-steps span the full scroll traverse (higher = faster flapping)

const FLIP_COLS = 3;
const FLIP_ROWS = 3;
const FLIP_FRAMES = FLIP_COLS * FLIP_ROWS;
// Each sprite frame represents a fixed rotation state of the plane art.
// FLIP_FRAME_ANGLE is the angular slice each frame covers, used to pick
// the right bitmap frame for a given flight angle instead of animating on
// a timer that's disconnected from where the plane actually is on the path.
const FLIP_FRAME_ANGLE = 360 / FLIP_FRAMES;

function angleToFrame(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  return Math.round(a / FLIP_FRAME_ANGLE) % FLIP_FRAMES;
}

// Ping-pong flip animation for the scroll-driven flight: skip the first 3
// (too-flat-looking) sprite frames and bounce back and forth through the
// rest — 3,4,5,6,7,8,7,6,5,4,3,4,5... — instead of cycling through the
// whole sheet in one direction like angleToFrame does.
const FLIP_SKIP_FRAMES = 3;                                // ← frames to skip at the start of the sheet
const FLIP_USABLE_COUNT = FLIP_FRAMES - FLIP_SKIP_FRAMES;  // usable frames: 3..8 (6 frames)
const FLIP_PINGPONG_PERIOD = (FLIP_USABLE_COUNT - 1) * 2;  // one full forward+back cycle = 10 steps

function pingPongFlipFrame(step: number): number {
  let m = Math.round(step) % FLIP_PINGPONG_PERIOD;
  if (m < 0) m += FLIP_PINGPONG_PERIOD;
  const offset = m <= FLIP_USABLE_COUNT - 1 ? m : FLIP_PINGPONG_PERIOD - m;
  return FLIP_SKIP_FRAMES + offset;
}

// Continuous (non-ping-pong) version for the curved click-flight: the loop
// spins steadily in one direction, so as rotation angle increases it just
// cycles forward through frames 3..8 repeatedly, rather than bouncing.
function angleToRestrictedFrame(deg: number): number {
  let a = deg % 360;
  if (a < 0) a += 360;
  const step = Math.round(a / (360 / FLIP_USABLE_COUNT)) % FLIP_USABLE_COUNT;
  return FLIP_SKIP_FRAMES + step;
}

const PLANE_GAME_SIZE = 160;
const GRAVITY = 0.4;
const THRUST = -1.5;
const OBSTACLE_INTERVAL = 100;
const WALL_GAP_PX = 160;
const BLOCK_SIZE = 36;
const OBSTACLE_SPEED = 0.5;
const GAME_H = 400;
// Max nose-up/nose-down tilt (deg) used to pick a sprite frame in-game,
// driven by vertical velocity — same trick as the flight-loop rotation.
const GAME_TILT_MAX_DEG = 45;
const GAME_TILT_PER_VEL = 4;

// ── LOOP-THE-LOOP FLIGHT PATH ──────────────────────────
// Shape is authored in a small "local" coordinate space (x right, y down).
// At flight time it's fitted between the real click point and the real
// destination with a rotate+scale transform, so the loop always reads
// correctly no matter where on screen the plane was clicked.
const FLIGHT_DURATION = 5000;               // ← total time (ms) for the loop flight (phase 1) — doubled to slow the curve
const GAME_FRAME_SLIDE_DURATION = 3000;       // ← ms — controls ONLY the visual slide-in of the game frame
const POST_LOOP_WAIT_MS = 300;                // ← ms to wait after the loop flight ends before flying into the game area (independent of FLIGHT_DURATION)
const FLY_IN_DURATION = 400;                  // ← ms for the plane to fly from loop-end into the game slot (was an unbounded lerp before)
const PATH_LP0 = { x: 0, y: 0 };              // start
const PATH_LP1 = { x: 18, y: -50 };           // liftoff control 1
const PATH_LP2 = { x: -2, y: -95 };           // liftoff control 2
const PATH_LP3 = { x: 8, y: -125 };           // liftoff end / loop entry
const PATH_LOOP_RADIUS = 58;                  // ← loop size
const PATH_LOOP_SWEEP_DEG = -360;             // ← negative = curls left; exactly 360 = one clean rotation
const PATH_LOCAL_END = { x: 175, y: -245 };   // where the local path ends
const PATH_APPROACH_HANDLE = 70;              // ← how "straight" the exit from the loop is
const PATH_APPROACH_P2_OFFSET = { x: -15, y: 10 };
const PATH_LIFT_FRAC = 0.18;                  // ← time budget: liftoff
const PATH_LOOP_FRAC = 0.54;                  // ← time budget: loop
const PATH_APPROACH_FRAC = 0.28;              // ← time budget: approach (should sum to 1)

interface Trail { id: number; x: number; seed: number; }
interface Obstacle {
  id: number;
  type: "wall" | "block";
  x: number;
  gapY?: number;
  blockY?: number;
}

type Phase = "idle" | "flipping" | "game" | "dead" | "returning" | "death";
type Vec = { x: number; y: number };

// ── PATH MATH (pure, no React) ──────────────────────────
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

// Loop geometry, derived once from the constants above.
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

// Sample the local path at progress s (0..1). Returns a point plus a
// CONTINUOUS (unwrapped) tangent angle so rotation never snaps at ±180°.
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
      angle: theta + PATH_LOOP_HALF_TURN, // continuous by construction
    };
  }
  const t = (s - PATH_LIFT_FRAC - PATH_LOOP_FRAC) / PATH_APPROACH_FRAC;
  const pt = cubicPoint(PATH_APP_P0, PATH_APP_P1, PATH_APP_P2, PATH_APP_P3, t);
  const tanNow = v.angleOf(cubicTangent(PATH_APP_P0, PATH_APP_P1, PATH_APP_P2, PATH_APP_P3, t));
  const tanStart = v.angleOf(cubicTangent(PATH_APP_P0, PATH_APP_P1, PATH_APP_P2, PATH_APP_P3, 0));
  let delta = tanNow - tanStart;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  const loopExitAngle = PATH_THETA_EXIT + PATH_LOOP_HALF_TURN; // continuous with the loop segment above
  return { pt, angle: loopExitAngle + delta };
}

// Fits the local path between real on-screen start/end points via a
// similarity transform (rotate + uniform scale), preserving the loop shape.
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

// Matches Lenis's default smooth-scroll easing (exponential ease-out) so the
// plane's flight motion feels consistent with the page's scroll feel.
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

  // ALL tween state together at top — critical for hook ordering
  const [tweenX, setTweenX] = useState(0);
  const [tweenY, setTweenY] = useState(0);
  const [tweenScale, setTweenScale] = useState(1);
  const [tweenVisible, setTweenVisible] = useState(false);

  const [gameFrameSlide, setGameFrameSlide] = useState(0);
  const [planeReady, setPlaneReady] = useState(false);
  const [gameFrameOffscreen, setGameFrameOffscreen] = useState(true);
  const [planeY, setPlaneY] = useState(150);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // Refs — no re-render needed
  const frozenX = useRef(0);
  const frozenY = useRef(0);
  const velRef = useRef(0);
  const planeYRef = useRef(150);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const frameCountRef = useRef(0);
  const obstacleIdRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdingRef = useRef(false);
  const tweenRafRef = useRef<number | null>(null);
  const tweenToGameRafRef = useRef<number | null>(null);
  // Was previously reset to `false` in the component body on every render,
  // which fought with the async rAF game loop and made physics skip
  // frames erratically. It should only ever be set from inside the game
  // effect / the flight-landing callback, never from render.
  const gameReadyRef = useRef(false);
  const gameStartedRef = useRef(false);

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

      // Ping-pong flip-book tied to progress — reverses automatically on
      // scroll-up because it's just f(prog), and bounces 3→8→3 instead of
      // spinning through the sheet in one direction.
      const flipStep = prog * MANEUVER_STEPS_PER_SCROLL;
      setFlipFrame(pingPongFlipFrame(flipStep));

      // Sine "altitude" wave layered on top of the linear left-right
      // travel — reads as looping/diving instead of a flat straight line.
      const wave = Math.sin(prog * Math.PI * 2 * MANEUVER_WAVE_CYCLES) * MANEUVER_WAVE_AMPLITUDE;
      setPlaneYOffset(wave);

      if (scrollDelta > 0) {
        if (lastTrailX.current >= newX) lastTrailX.current = newX - TRAIL_SPACING;
        const newTrails: Trail[] = [];
        let nextX = lastTrailX.current + TRAIL_SPACING;
        while (nextX <= newX - TRAIL_SPACING) {
          newTrails.push({ id: trailIdRef.current++, x: nextX, seed: Math.random() });
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

  // ── CLICK ────────────────────────────────────────────
  const handlePlaneClick = useCallback(() => {
    if (phase !== "idle") return;

    const img = planeImgRef.current;
    if (!img) return;

    // Get exact screen position of plane image
    const rect = img.getBoundingClientRect();

    // Store frozen position
    frozenX.current = rect.left;
    frozenY.current = rect.top;

    // Set tween to EXACT same position as plane — no jump
    setTweenX(rect.left);
    setTweenY(rect.top);
    setTweenScale(1);
    setFlipFrame(0);

    // Show tween div BEFORE hiding plane (same render batch)
    setTweenVisible(true);
    setPhase("flipping");

    // Lock scroll
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const lenis = (window as any).__lenis;
    if (lenis) lenis.stop();

    // Slide content left
    document.body.classList.add("game-active");

    // Pre-position game frame off-screen (full viewport width to the right), wait for paint, then slide in together with content
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

    // Real on-screen start/end points — the CENTER of the plane, since
    // rotation below happens around the plane's own center, not its corner.
    const centerStart: Vec = {
      x: frozenX.current + DISPLAY_SIZE / 2,
      y: frozenY.current + DISPLAY_SIZE / 2,
    };
    const targetX = window.innerWidth * 0.29 + 0;    // ← destination X offset (change the + 0)
    const targetY = window.innerHeight / 2 - DISPLAY_SIZE / 1.7 + 0; // ← destination Y offset (change the + 0)
    const targetScale = 0.8;                          // ← end scale
    const centerEnd: Vec = {
      x: targetX + (DISPLAY_SIZE * targetScale) / 2,
      y: targetY + (DISPLAY_SIZE * targetScale) / 2,
    };

    const toScreen = buildFlightTransform(centerStart, centerEnd);
    const baselineAngle = samplePath(0).angle; // plane starts unrotated — measure change from here

    const startTime = performance.now();
    const totalDuration = FLIGHT_DURATION; // ← total loop-flight time (ms)
    const gameFrameDuration = POST_LOOP_WAIT_MS;

    let lastScreenPt = centerStart;
    let lastScale = 1;

    const loop = (now: number) => {
      const rawP = Math.min(1, (now - startTime) / totalDuration);
      const s = easeLenis(rawP); // ← overall pacing along the path — matches Lenis's smooth-scroll feel

      const { pt, angle } = samplePath(s);
      const screenPt = toScreen(pt);
      const curScale = 1 + (targetScale - 1) * s;
      const rotationDeg = ((angle - baselineAngle) * 180) / Math.PI;

      setTweenX(screenPt.x - DISPLAY_SIZE / 2);
      setTweenY(screenPt.y - DISPLAY_SIZE / 2);
      setTweenScale(curScale);
      // Rotation comes from picking the matching pre-rotated sprite frame,
      // NOT from a CSS rotate() — doing both at once is what made the
      // flight look like a double-spin instead of a clean loop.
      // Restricted to frames 3-8 (skipping the too-flat 0-2 frames) — see
      // angleToRestrictedFrame above.
      setFlipFrame(angleToRestrictedFrame(rotationDeg));

      lastScreenPt = screenPt;
      lastScale = curScale;

      if (rawP < 1) {
        tweenRafRef.current = requestAnimationFrame(loop);
      } else {
        // Fixed delay after the loop ends, independent of FLIGHT_DURATION
        const remaining = Math.max(0, gameFrameDuration);
        setTimeout(() => {
          const gameAreaEl = document.getElementById("game-area");
          if (!gameAreaEl) {
            setTweenVisible(false);
            setPhase("game");
            return;
          }
          const gameRect = gameAreaEl.getBoundingClientRect();
          const destX = gameRect.left + 50;
          const destY = gameRect.top + 150;
          const destScale = PLANE_GAME_SIZE / DISPLAY_SIZE;
          const srcX = lastScreenPt.x - DISPLAY_SIZE / 2;
          const srcY = lastScreenPt.y - DISPLAY_SIZE / 2;
          const srcScale = lastScale;
          const flyStart = performance.now();
          const flyIn = (flyNow: number) => {
            const ft = Math.min(1, (flyNow - flyStart) / FLY_IN_DURATION);
            const fe = 1 - Math.pow(1 - ft, 3); // ease-out cubic — fixed, predictable duration (was an unbounded lerp)
            setTweenX(srcX + (destX - srcX) * fe);
            setTweenY(srcY + (destY - srcY) * fe);
            setTweenScale(srcScale + (destScale - srcScale) * fe);
            if (ft < 1) {
              tweenToGameRafRef.current = requestAnimationFrame(flyIn);
            } else {
              setTweenVisible(false);
              setPlaneReady(true);
              gameReadyRef.current = true;
              setPhase("game");
            }
          };
          tweenToGameRafRef.current = requestAnimationFrame(flyIn);
        }, remaining);
      }
    };

    tweenRafRef.current = requestAnimationFrame(loop);

    return () => {
      if (tweenRafRef.current) cancelAnimationFrame(tweenRafRef.current);
      if (tweenToGameRafRef.current) cancelAnimationFrame(tweenToGameRafRef.current);
    };
  }, [phase]);

  // ── GAME LOOP ────────────────────────────────────────
  useEffect(() => {
    if (phase !== "game") return;

    planeYRef.current = 150;
    velRef.current = 0;
    obstaclesRef.current = [];
    frameCountRef.current = 0;
    obstacleIdRef.current = 0;
    setPlaneY(150);
    setObstacles([]);
    setSeconds(0);
    setCanGoBack(false);
    setGameStarted(false);
    gameStartedRef.current = false;
    // gameReadyRef / planeReady are set by the flyIn tween right before
    // phase flips to "game" — don't touch them here.

    timerRef.current = setInterval(() => {
      if (gameStartedRef.current) setSeconds((s) => s + 1);
    }, 1000);

    const loop = () => {
      if (!gameReadyRef.current) {
        gameLoopRef.current = requestAnimationFrame(loop);
        return;
      }
      frameCountRef.current++;

      if (!gameStartedRef.current) {
        gameLoopRef.current = requestAnimationFrame(loop);
        return;
      }

      if (holdingRef.current) velRef.current += THRUST;
      velRef.current += GRAVITY;
      velRef.current = Math.max(-10, Math.min(12, velRef.current));
      planeYRef.current = Math.max(0, Math.min(GAME_H - PLANE_GAME_SIZE,
        planeYRef.current + velRef.current));
      setPlaneY(planeYRef.current);

      // Nose-up/nose-down tilt from vertical velocity, expressed via the
      // same discrete sprite frame the flight loop uses — keeps the plane
      // art consistent everywhere instead of switching rotation systems.
      const tiltDeg = Math.max(-GAME_TILT_MAX_DEG, Math.min(GAME_TILT_MAX_DEG, -velRef.current * GAME_TILT_PER_VEL));
      setFlipFrame(angleToFrame(tiltDeg));

      if (frameCountRef.current % OBSTACLE_INTERVAL === 0) {
        const type = Math.random() > 0.5 ? "wall" : "block";
        obstaclesRef.current.push({
          id: obstacleIdRef.current++, type, x: 105,
          gapY: type === "wall" ? 15 + Math.random() * 45 : undefined,
          blockY: type === "block" ? 10 + Math.random() * 75 : undefined,
        });
      }

      obstaclesRef.current = obstaclesRef.current
        .map((o) => ({ ...o, x: o.x - OBSTACLE_SPEED }))
        .filter((o) => o.x > -5);
      setObstacles([...obstaclesRef.current]);

      const pL = 12, pR = pL + (PLANE_GAME_SIZE / window.innerWidth * 80) * 100;
      const pT = (planeYRef.current / GAME_H) * 100;
      const pB = pT + (PLANE_GAME_SIZE / GAME_H) * 100;

      for (const obs of obstaclesRef.current) {
        if (obs.x + 2.5 < pL || obs.x > pR) continue;
        if (obs.type === "wall" && obs.gapY !== undefined) {
          const gB = obs.gapY + (WALL_GAP_PX / GAME_H) * 100;
          if (pT < obs.gapY || pB > gB) { triggerDeath(); return; }
        }
        if (obs.type === "block" && obs.blockY !== undefined) {
          const bB = obs.blockY + (BLOCK_SIZE / GAME_H) * 100;
          if (pT < bB && pB > obs.blockY) { triggerDeath(); return; }
        }
      }

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      gameReadyRef.current = false;
    };
  }, [phase]);

  // ── WAIT FOR SPACE TO START ───────────────────────────
  useEffect(() => {
    if (phase !== "game") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !gameStartedRef.current) {
        e.preventDefault();
        gameStartedRef.current = true;
        setGameStarted(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // ── DEATH ────────────────────────────────────────────
  const triggerDeath = useCallback(() => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("dead");
    setTimeout(() => setCanGoBack(true), 2000);
  }, []);

  // ── RETURN ───────────────────────────────────────────
  const handleReturn = useCallback(() => {
    if (!canGoBack) return;
    setPhase("returning");
    setGameFrameSlide(window.innerWidth);
    document.body.classList.remove("game-active");
    document.body.classList.add("game-returning");

    setTimeout(() => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      const lenis = (window as any).__lenis;
      if (lenis) lenis.start();
      document.body.classList.remove("game-returning");
      setPhase("death");
      setTrails([]);
    }, 350);
  }, [canGoBack]);

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
        {/* Pencil-roughen filter for trail dashes — feTurbulence distorts the
            glyph edges so the "—" reads as a hand-sketched pencil stroke
            instead of a clean digital line, matching the flip.png art style. */}
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
            // Per-trail randomized phase (negative delay) and duration so
            // dashes bob out of sync instead of moving as one rigid strip —
            // same "wiggle" feel as the plane's sine-wave bob.
            animation: `planeTrailWiggle ${TRAIL_WIGGLE_DURATION * (0.7 + trail.seed * 0.6)}s ease-in-out infinite`,
            animationDelay: `${-trail.seed * TRAIL_WIGGLE_DURATION}s`,
            // Pencil texture: SVG turbulence roughens the stroke edges, and
            // a couple of soft offset shadows fake uneven pencil pressure.
            filter: "url(#pencilTexture)",
            textShadow: "0.5px 0.5px 0 rgba(0,0,0,0.15), -0.5px 0px 0 rgba(0,0,0,0.1)",
          }}>{TRAIL_CHAR}</span>
        ))}

        {/* flip.png sprite — only shown in idle. Hidden same frame tween appears */}
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

        {/* deathfx.png after returning */}
        {phase === "death" && (
          <img src="/deathfx.png" alt="death" style={{
            position: "absolute", top: "50%",
            transform: "translateY(-50%)",
            left: planeX,
            width: DISPLAY_SIZE, height: DISPLAY_SIZE,
            objectFit: "contain", imageRendering: "pixelated",
            pointerEvents: "none",
          }} />
        )}
      </div>

      {/* ── TWEEN PLANE — portaled to body so fixed pos isn't broken by parent transform ── */}
      {tweenVisible && typeof document !== "undefined" && createPortal(
        <div style={{
          position: "fixed",
          left: tweenX,
          top: tweenY,
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE,
          zIndex: 9999,
          pointerEvents: "none",
          // No CSS rotate here — rotation is baked into which sprite frame
          // is showing (see flipCol/flipRow below), so this only scales.
          transform: `scale(${tweenScale})`,
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


      {/* ── GAME OVERLAY — portaled to body ── */}
      {(phase === "flipping" || phase === "game" || phase === "dead") &&
       typeof document !== "undefined" && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "transparent",
          pointerEvents: phase === "flipping" ? "none" : "auto",
        }}>
          <div style={{
            transform: `translateX(${gameFrameSlide}px)`,
            transition: gameFrameOffscreen ? "none" : `transform ${GAME_FRAME_SLIDE_DURATION / 1000}s ease-in-out`,
            position: "relative",
            display: "inline-block",
          }}>
            <img
              src={phase === "dead" ? "/backbut.png" : "/gameframe.png"}
              alt="frame"
              style={{
                display: "block", imageRendering: "pixelated",
                pointerEvents: "none", position: "relative",
                zIndex: 3, maxHeight: "80vh", width: "auto",
              }}
            />

            {phase === "game" && (
              <div style={{
                position: "absolute", top: "6%", right: "8%",
                zIndex: 4, fontWeight: "bold", fontSize: "1rem",
                color: "#333", fontVariantNumeric: "tabular-nums",
              }}>{seconds}s</div>
            )}

            <div
              onMouseDown={() => { holdingRef.current = true; }}
              onMouseUp={() => { holdingRef.current = false; }}
              onTouchStart={(e) => { e.preventDefault(); holdingRef.current = true; }}
              onTouchEnd={() => { holdingRef.current = false; }}
              id="game-area"
              style={{
                position: "absolute",
                top: "10%", left: "8%", right: "8%", bottom: "10%",
                overflow: "hidden", zIndex: 2,
                cursor: phase === "game" ? "pointer" : "default",
              }}
            >
              <div style={{
                position: "absolute", left: 50, top: planeY,
                width: PLANE_GAME_SIZE, height: PLANE_GAME_SIZE,
                imageRendering: "pixelated",
                pointerEvents: "none", zIndex: 2,
                backgroundImage: "url('/flip.png')",
                backgroundSize: `${FLIP_COLS * 100}% ${FLIP_ROWS * 100}%`,
                backgroundPosition: `${flipCol * (100 / (FLIP_COLS - 1))}% ${flipRow * (100 / (FLIP_ROWS - 1))}%`,
                opacity: planeReady ? 1 : 0,
              }} />

              {phase === "game" && planeReady && !gameStarted && (
                <div style={{
                  position: "absolute", inset: 0, zIndex: 5,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none",
                }}>
                  <p style={{
                    color: "#7a5c4e", fontWeight: "bold",
                    fontSize: "0.9rem", letterSpacing: "0.1em",
                    textTransform: "uppercase", textAlign: "center",
                    textShadow: "1px 1px 0 rgba(255,255,255,0.6)",
                  }}>press space<br/>to start</p>
                </div>
              )}

              {obstacles.map((obs) => (
                <div key={obs.id} style={{ position: "absolute", inset: 0 }}>
                  {obs.type === "wall" && obs.gapY !== undefined && (
                    <>
                      <div style={{
                        position: "absolute", right: `${obs.x}%`, top: 0,
                        width: 22, height: `${obs.gapY}%`,
                        backgroundColor: "#7a5c4e", borderRadius: "0 0 4px 4px",
                      }} />
                      <div style={{
                        position: "absolute", right: `${obs.x}%`, bottom: 0,
                        width: 22,
                        height: `${100 - obs.gapY - (WALL_GAP_PX / GAME_H) * 100}%`,
                        backgroundColor: "#7a5c4e", borderRadius: "4px 4px 0 0",
                      }} />
                    </>
                  )}
                  {obs.type === "block" && obs.blockY !== undefined && (
                    <div style={{
                      position: "absolute", right: `${obs.x}%`,
                      top: `${obs.blockY}%`,
                      width: BLOCK_SIZE, height: BLOCK_SIZE,
                      backgroundColor: "#7a5c4e", borderRadius: 3,
                    }} />
                  )}
                </div>
              ))}
            </div>

            {phase === "dead" && (
              <div onClick={handleReturn} style={{
                position: "absolute", inset: 0, zIndex: 10,
                cursor: canGoBack ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {!canGoBack && (
                  <p style={{
                    color: "#7a5c4e", fontWeight: "bold",
                    fontSize: "0.9rem", letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}>wait...</p>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}