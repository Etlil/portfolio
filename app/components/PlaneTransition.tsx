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

const FLIP_COLS = 3;
const FLIP_ROWS = 3;
const FLIP_FRAMES = FLIP_COLS * FLIP_ROWS;
const FLIP_FPS = 16;

const PLANE_GAME_SIZE = 160;
const GRAVITY = 0.4;
const THRUST = -1.5;
const OBSTACLE_INTERVAL = 100;
const WALL_GAP_PX = 160;
const BLOCK_SIZE = 36;
const OBSTACLE_SPEED = 0.5;
const GAME_H = 400;

interface Trail { id: number; x: number; }
interface Obstacle {
  id: number;
  type: "wall" | "block";
  x: number;
  gapY?: number;
  blockY?: number;
}

type Phase = "idle" | "flipping" | "game" | "dead" | "returning" | "death";

export default function PlaneTransition() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const planeImgRef = useRef<HTMLImageElement>(null);

  const [planeX, setPlaneX] = useState(-DISPLAY_SIZE);
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
  const gameReadyRef = useRef(false);
  gameReadyRef.current = false;
  const flipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

      if (scrollDelta > 0) {
        if (lastTrailX.current >= newX) lastTrailX.current = newX - TRAIL_SPACING;
        const newTrails: Trail[] = [];
        let nextX = lastTrailX.current + TRAIL_SPACING;
        while (nextX <= newX - TRAIL_SPACING) {
          newTrails.push({ id: trailIdRef.current++, x: nextX });
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

  // ── FLIP TWEEN ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "flipping") return;

    const startX = frozenX.current;
    const startY = frozenY.current;
    const targetX = window.innerWidth * 0.29 + 0;    // ← destination X offset (change the + 0)
    const targetY = window.innerHeight / 2 - DISPLAY_SIZE / 1.7 + 0; // ← destination Y offset (change the + 0)
    const startScale = 1;
    const targetScale = 0.8;                           // ← end scale

    let curX = startX;
    let curY = startY;
    let curScale = startScale;
    let f = 0;
    const startTime = performance.now();
    const totalDuration = 800; // ← total tween time (ms), match with CSS slide
    const gameFrameDuration = 1700; // ← match game frame slide duration

    // Flip frames
    flipIntervalRef.current = setInterval(() => {
      f = Math.min(f + 1, FLIP_FRAMES - 1);
      setFlipFrame(f);
    }, 1000 / FLIP_FPS);

    const loop = (now: number) => {
      const rawP = Math.min(1, (now - startTime) / totalDuration);
      const eased = rawP === 1 ? 1 : 1 - Math.pow(2, -10 * rawP);

      const wantX = startX + (targetX - startX) * eased;
      const wantY = startY + (targetY - startY) * eased;
      const wantScale = startScale + (targetScale - startScale) * eased;

      curX += (wantX - curX) * 0.12; // ← lerp speed 0.01=slow 0.3=fast
      curY += (wantY - curY) * 0.12;
      curScale += (wantScale - curScale) * 0.12;

      setTweenX(curX);
      setTweenY(curY);
      setTweenScale(curScale);

      if (rawP < 1) {
        tweenRafRef.current = requestAnimationFrame(loop);
      } else {
        // Wait for game frame to finish sliding in, then fly into it
        const remaining = gameFrameDuration - totalDuration;
        setTimeout(() => {
          const gameAreaEl = document.getElementById("game-area");
          if (!gameAreaEl) { setTweenVisible(false); setPhase("game"); return; }
          const gameRect = gameAreaEl.getBoundingClientRect();
          const destX = gameRect.left + 50;
          const destY = gameRect.top + 150;
        const destScale = PLANE_GAME_SIZE / DISPLAY_SIZE;
        let tX = curX, tY = curY, tS = curScale;
        const flyIn = () => {
          tX += (destX - tX) * 0.1;
          tY += (destY - tY) * 0.1;
          tS += (destScale - tS) * 0.1;
          setTweenX(tX);
          setTweenY(tY);
          setTweenScale(tS);
          const done = Math.abs(tX - destX) < 1 && Math.abs(tY - destY) < 1;
          if (!done) {
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
    // planeReady is set by flyIn tween before phase switches to game

    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    const loop = () => {
      if (!gameReadyRef.current) {
        gameLoopRef.current = requestAnimationFrame(loop);
        return;
      }
      frameCountRef.current++;

      if (holdingRef.current) velRef.current += THRUST;
      velRef.current += GRAVITY;
      velRef.current = Math.max(-10, Math.min(12, velRef.current));
      planeYRef.current = Math.max(0, Math.min(GAME_H - PLANE_GAME_SIZE,
        planeYRef.current + velRef.current));
      setPlaneY(planeYRef.current);

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
    };
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
        {trails.map((trail) => (
          <span key={trail.id} style={{
            position: "absolute", top: "50%",
            transform: "translateY(-50%)",
            left: trail.x, fontSize: `${TRAIL_FONT_SIZE}px`,
            color: "rgba(0,0,0,0.35)", fontWeight: "bold",
            lineHeight: 1, pointerEvents: "none", userSelect: "none",
          }}>{TRAIL_CHAR}</span>
        ))}

        {/* plane.png — only shown in idle. Hidden same frame tween appears */}
        {phase === "idle" && (
          <img
            ref={planeImgRef}
            src="/plane.png"
            alt="plane"
            onClick={handlePlaneClick}
            style={{
              position: "absolute", top: "50%",
              transform: "translateY(-50%)",
              left: planeX,
              width: DISPLAY_SIZE, height: DISPLAY_SIZE,
              objectFit: "contain", imageRendering: "pixelated",
              cursor: "pointer",
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
          transform: `scale(${tweenScale})`,
          transformOrigin: "top left",
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
            transition: gameFrameOffscreen ? "none" : "transform 1.7s ease-in-out",
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