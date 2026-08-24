"use client";
import { useEffect, useRef } from "react";
import { gameScale, planeLayout } from "./gameLayout";

// Keep these in sync with the sprite sheet used by PlaneTransition.tsx
const FLIP_COLS = 3;
const FLIP_ROWS = 3;
const FLIP_FRAME_W = 640; // native size of ONE frame in flip.png (edit to match your actual sheet)
const FLIP_FRAME_H = 640;

/* ── EVERY TUNED NUMBER IN THE GAME, AT SCALE 1 ──
   Each of these was dialled in against the reference play area in
   gameLayout.ts, and each is multiplied by that file's scale factor before it
   is used. Gathering them here rather than leaving them inline is what makes it
   possible to state the rule once: lengths scale, and so do the physics, which
   are lengths per second (and per second squared). Times and ratios — spawn
   delays, the flap frame rate, the rotation clamp — do not, because they are
   not lengths, and scaling them would change the game rather than its size.

   The result is a game that plays identically on a phone and a desktop: same
   arcs, same reaction times, same difficulty. Only the drawing is smaller. */
const BASE = {
  gravity: 1000,          // px/s² downward
  thrustAccel: 1800,      // px/s² while held
  tapImpulse: -300,       // px/s added on each tap
  maxRiseSpeed: -420,     // px/s ceiling on climb
  obstacleSpeed: 160,     // px/s leftwards
  obstacleScale: 0.4,     // multiplier on obs.png's native size
  obstacleMarginRight: 60,// px offscreen it spawns
  obstacleDespawnX: -100, // px offscreen it is destroyed
  cloudSpeedMin: 70,      // px/s
  cloudSpeedMax: 71,
  cloudMargin: 150,       // px offscreen clouds spawn/despawn
  scoreFont: 24,          // px
  bestFont: 14,
  startFont: 20,
  gameOverFont: 22,
  backIcon: 24,           // px square
  backInset: 10,          // px from the top-left corner
};

/* Type has a hard floor: 11px is legible, 7px is a smudge. This is the one
   place the scale rule is deliberately broken, because a pixel is a pixel
   however big the canvas is. */
const MIN_FONT = 11;
/* …and the back button has a floor too, but a different one: it has to stay big
   enough to hit with a fingertip. */
const MIN_BACK_ICON = 26;
const px = (n: number) => `${Math.round(n)}px`;

interface GameCanvasProps {
  width: number;
  height: number;
  startFrame?: number;
  onExit: () => void;
  onReady: () => void;
  onStart: () => void;
}

export default function GameCanvas({ width, height, startFrame = 0, onExit, onReady, onStart }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit; // always call the latest handler from inside the scene

  useEffect(() => {
    let destroyed = false;

    (async () => {
      const Phaser = (await import("phaser")).default;
      if (destroyed || !containerRef.current) return;

      class MainScene extends Phaser.Scene {
        plane!: Phaser.Physics.Arcade.Sprite;
        isStarted = false;
        startText!: Phaser.GameObjects.Text;
        isThrusting = false;

        clouds!: Phaser.GameObjects.Group;
        cloudTimer!: Phaser.Time.TimerEvent;
        cloudSpawnY = { min: 20, max: 0 }; // max gets set in layout() once the canvas size is known

        obstacles!: Phaser.Physics.Arcade.Group;
        obstacleTimer!: Phaser.Time.TimerEvent;
        isGameOver = false;
        gameOverText!: Phaser.GameObjects.Text;
        backBtn!: Phaser.GameObjects.Image;
        // The canvas size layout() last ran against, so the next run knows how
        // far everything has to move.
        lastW = 0;
        lastH = 0;

        score = 0;
        scoreText!: Phaser.GameObjects.Text;
        highScore = 0;
        highScoreText!: Phaser.GameObjects.Text;

        /* The canvas's CURRENT size, read fresh every time rather than captured
           from the props at mount. The game outlives any one size: the play
           area is a percentage of a frame that is itself a percentage of the
           window, so it changes on every resize and on every rotation. Reading
           through the scale manager means one resize handler re-lays-out
           everything instead of each spawn remembering a stale number. */
        get W() { return this.scale.width; }
        get H() { return this.scale.height; }
        /** Everything in the game is a multiple of this — see gameLayout.ts. */
        get s() { return gameScale(this.scale.width, this.scale.height); }

        preload() {
          this.load.spritesheet("plane", "/flip.png", {
            frameWidth: FLIP_FRAME_W,
            frameHeight: FLIP_FRAME_H,
          });
          this.load.image("cloud1", "/cloud1.png");
          this.load.image("cloud2", "/cloud2.png");
          this.load.image("obs", "/obs.png");
          // Rasterised well above the size it is drawn at, so scaling it DOWN
          // for a small canvas stays crisp instead of blurring an already-tiny
          // 24px bitmap back up on a desktop.
          this.load.svg("backIcon", "/back.svg", { width: 96, height: 96 });
        }

        /* ── EVERYTHING THAT DEPENDS ON THE CANVAS SIZE ──
           Called once from create() and again on every resize, so a rotation or
           a window drag re-places the HUD, re-sizes the plane and re-anchors the
           obstacles instead of leaving them laid out for a canvas that no longer
           exists. Nothing here touches game STATE — only where things are and
           how big they are — so it is safe to run mid-game. */
        layout() {
          const s = this.s;
          const W = this.W;
          const H = this.H;

          /* How much the canvas changed by. Everything already in play is moved
             by this ratio so a rotation or a window drag carries the game with
             it rather than leaving the plane and the obstacles at coordinates
             that are now off the edge — where `collideWorldBounds` cannot help,
             because a body already fully outside the bounds never collides with
             them on the way back in. */
          const rx = this.lastW ? W / this.lastW : 1;
          const ry = this.lastH ? H / this.lastH : 1;
          this.lastW = W;
          this.lastH = H;

          this.physics.world.setBounds(0, 0, W, H);
          this.cloudSpawnY.min = 20 * s;
          this.cloudSpawnY.max = H * 0.4;

          const plane = planeLayout(W, H);
          this.plane.setDisplaySize(plane.size, plane.size);
          if (this.isStarted) {
            // Mid-flight: carry it across proportionally, then make sure it is
            // still inside the new bounds.
            this.plane.setPosition(
              Phaser.Math.Clamp(this.plane.x * rx, plane.size / 2, W - plane.size / 2),
              Phaser.Math.Clamp(this.plane.y * ry, plane.size / 2, H - plane.size / 2)
            );
          } else {
            // Not started yet — it belongs at the spot the flight handed it over
            // at, which is where PlaneTransition's CSS plane also sits.
            this.plane.setPosition(plane.left + plane.size / 2, plane.top + plane.size / 2);
          }

          // Fonts: scaled, but never below the point where they stop being
          // readable at all.
          this.scoreText.setFontSize(px(Math.max(MIN_FONT, BASE.scoreFont * s)));
          this.highScoreText.setFontSize(px(Math.max(MIN_FONT, BASE.bestFont * s)));
          this.startText.setFontSize(px(Math.max(MIN_FONT, BASE.startFont * s)));
          this.gameOverText.setFontSize(px(Math.max(MIN_FONT, BASE.gameOverFont * s)));

          /* The HUD stacks by MEASUREMENT, not by two scaled constants. Once
             the type stops shrinking at its floor but the positions carry on
             scaling, a small canvas has the two lines growing into each other —
             so put the second one directly under the first, whatever height the
             first turned out to be. */
          this.scoreText.setPosition(W / 2, Math.max(6, 20 * s));
          this.highScoreText.setPosition(
            W / 2,
            this.scoreText.y + this.scoreText.height + 6 * s
          );
          this.startText.setPosition(W / 2, H / 2 + 60 * s);
          this.gameOverText.setPosition(W / 2, H / 2);

          const back = Math.max(MIN_BACK_ICON, BASE.backIcon * s);
          this.backBtn.setDisplaySize(back, back);
          this.backBtn.setPosition(BASE.backInset * s, BASE.backInset * s);
          // The hit area is defined against the source image, so it follows the
          // display size automatically — but on a touch screen a 26px icon is
          // still a small target, so pad the interactive area outwards.
          const padSrc = (this.backBtn.width * 0.35) | 0;
          this.backBtn.setInteractive(
            new Phaser.Geom.Rectangle(
              -padSrc,
              -padSrc,
              this.backBtn.width + padSrc * 2,
              this.backBtn.height + padSrc * 2
            ),
            Phaser.Geom.Rectangle.Contains
          );

          /* Physics are lengths per unit time, so they scale with the geometry —
             otherwise a phone-sized canvas would have the plane crossing its own
             height in a fraction of the time it takes on a desktop, and no
             amount of tapping could keep up. */
          (this.physics.world.gravity as Phaser.Math.Vector2).y = BASE.gravity * s;

          // Obstacles already in flight were sized and anchored for the old
          // canvas; bring them with us rather than leaving them floating.
          this.obstacles.getChildren().forEach((child) => {
            const o = child as Phaser.Physics.Arcade.Sprite;
            if (!o.active) return;
            const fromTop = o.originY === 0;
            o.setScale(BASE.obstacleScale * s);
            o.x *= rx;
            o.y = fromTop ? 1 : H - 1;
            (o.body as Phaser.Physics.Arcade.Body).setVelocityX(-BASE.obstacleSpeed * s);
          });
        }

        create() {
          this.isGameOver = false;
          this.isStarted = false;
          this.isThrusting = false;

          this.physics.resume();

          /* The plane's size and start position come from the shared helper, not
             from constants of their own — PlaneTransition places its CSS plane
             from the very same call, so the moment this canvas appears the two
             planes are exactly on top of each other and the handoff is
             invisible. Duplicating the numbers here is what used to make that
             swap visible on any screen that wasn't the one they were tuned on. */
          const plane = planeLayout(this.W, this.H);
          this.plane = this.physics.add.sprite(
            plane.left + plane.size / 2,
            plane.top + plane.size / 2,
            "plane",
            startFrame
          );
          this.plane.setDisplaySize(plane.size, plane.size);
          this.plane.setDepth(1); // explicit: always above clouds (-1), regardless of add order

          if (!this.anims.exists("planeFlap")) {
            this.anims.create({
              key: "planeFlap",
              frames: [2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3].map((f) => ({ key: "plane", frame: f })),
              frameRate: 12, // ← flap speed, tweak as desired
              repeat: -1,
            });
          }
          this.plane.anims.stop();
          this.plane.setFrame(4); // static frame until the game actually starts

          this.plane.setCollideWorldBounds(true);
          const planeBody = this.plane.body as Phaser.Physics.Arcade.Body;
          planeBody.setAllowGravity(false);
          planeBody.enable = true;
          planeBody.setVelocity(0, 0);

          this.clouds = this.add.group();

          /* Positions and sizes below are placeholders — layout() sets the real
             ones at the end of create(), and again on every resize. Creating
             them at zero-ish and immediately laying out is what keeps a single
             piece of code responsible for where things go. */
          // A finger is not a mouse: say so when there is no mouse to click.
          const tapWord = this.sys.game.device.input.touch ? "TAP" : "CLICK";
          this.startText = this.add.text(0, 0, `${tapWord} TO START`, {
            fontFamily: "monospace", fontSize: "20px", color: "#000000",
          }).setOrigin(0.5);

          this.gameOverText = this.add.text(0, 0, `${tapWord} TO RESTART`, {
            fontFamily: "monospace", fontSize: "22px", color: "#000000",
          }).setOrigin(0.5).setDepth(1000).setVisible(false);

          this.score = 0;
          this.scoreText = this.add.text(0, 0, "0", {
            fontFamily: "monospace", fontSize: "24px", color: "#000000",
          }).setOrigin(0.5, 0).setDepth(1000);

          this.highScore = Number(localStorage.getItem("planeGameHighScore") || 0);
          this.highScoreText = this.add.text(0, 0, `BEST: ${this.highScore}`, {
            fontFamily: "monospace", fontSize: "14px", color: "#000000",
          }).setOrigin(0.5, 0).setDepth(1000);

          // Physics group (not a plain Graphics group like clouds) so each
          // obstacle gets a real Arcade body — that's what lets
          // physics.add.overlap() detect the plane touching one, AND it's
          // what the global debugShowBody/debugShowVelocity config is
          // already drawing a debug outline for automatically, same as
          // the plane's own hitbox.
          this.obstacles = this.physics.add.group();

          this.physics.add.overlap(this.plane, this.obstacles, () => this.gameOver(), undefined, this);
          this.plane.setDamping(true);
          this.plane.setDrag(0.9);
          // Hitbox scaled down to match the smaller PLANE_SIZE (was tuned
          // for a 160px sprite at 400x240/offset 70,170 — same ratio here)
          this.plane.setBodySize(275, 165); 
          this.plane.setOffset(183, 238);

          this.input.removeAllListeners();
          this.input.keyboard!.removeAllListeners();

          this.input.off("pointerdown");
          this.input.off("pointerup");
          this.input.off("pointerout");
          this.input.keyboard!.off("keydown-SPACE");
          this.input.keyboard!.off("keyup-SPACE");

          this.input.on("pointerdown", () => this.startThrust());
          this.input.on("pointerup", () => this.stopThrust());
          this.input.on("pointerout", () => this.stopThrust());
          this.input.keyboard!.on("keydown-SPACE", () => this.startThrust());
          this.input.keyboard!.on("keyup-SPACE", () => this.stopThrust());

          this.backBtn = this.add
            .image(0, 0, "backIcon")
            .setOrigin(0, 0)
            .setDepth(1000)
            .setInteractive({ useHandCursor: true });

          this.backBtn.on("pointerdown", (pointer: any, localX: any, localY: any, event: any) => {
            event.stopPropagation();
            onExitRef.current();
            });

          // Place and size everything against the canvas as it is right now…
          this.layout();
          // …and again whenever that changes. `scale.resize()` from React (on a
          // window resize or a rotation) fires this, which is what keeps the
          // HUD centred and the plane in proportion instead of laid out for a
          // canvas that has since changed shape.
          this.scale.on("resize", this.layout, this);
          this.events.once("shutdown", () => this.scale.off("resize", this.layout, this));

          // This notifies React when the first frame is actually drawn
          this.events.once("postrender", () => {
            onReady();
          });
        }

        startThrust() {
            if (this.isGameOver) {
                this.scene.restart(); // re-runs preload/create fresh, so every piece of state resets automatically
                return;
            }
            if (!this.isStarted) {
                this.isStarted = true;
                this.startText.setVisible(false);
                (this.plane.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
                onStart(); // Notify React that the game has started

                this.plane.play("planeFlap");

                this.spawnCloud();
                this.cloudTimer = this.time.addEvent({
                  delay: 3000,
                  callback: () => this.spawnCloud(),
                  loop: true,
                });

                this.obstacleTimer = this.time.addEvent({
                  delay: 2400,
                  callback: () => this.spawnObstacle(),
                  loop: true,
                });
            }
            this.isThrusting = true;
            const s = this.s;
            const body = this.plane.body as Phaser.Physics.Arcade.Body;
            body.setVelocityY(
              Math.max(body.velocity.y + BASE.tapImpulse * s, BASE.maxRiseSpeed * s)
            );
        }

        stopThrust() {
            this.isThrusting = false;
        }

        gameOver() {
            if (this.isGameOver) return;
            this.isGameOver = true;

            this.physics.pause(); // freezes the plane, all obstacles, and stops further overlap checks in one call
            this.obstacleTimer.remove(); // stop spawning new obstacles while frozen
            this.cloudTimer.remove(); // stop spawning new clouds while frozen

            this.tweens.pauseAll(); // freeze all in-flight cloud tweens in place
            this.plane.anims.pause(); // freeze the flap animation on the frame it was hit

            this.plane.setTint(0xff6666); // small visual feedback that something was hit
            this.gameOverText.setVisible(true);
        }

        spawnObstacle() {
          if (this.isGameOver) return;

          const s = this.s;
          const OBS_MARGIN_RIGHT = BASE.obstacleMarginRight * s;
          const speed = BASE.obstacleSpeed * s; // px/sec — separate from cloud speed
          const isTop = Phaser.Math.Between(0, 1) === 0;

          // Fixed distance in from whichever edge it's anchored to — tweak
          // these two if obstacles should sit closer to/further from the
          // top and bottom edges of the play area.
          const EDGE_OFFSET = 1;
          const y = isTop ? EDGE_OFFSET : this.H - EDGE_OFFSET;

          const obs = this.obstacles.create(this.W + OBS_MARGIN_RIGHT, y, "obs") as Phaser.Physics.Arcade.Sprite;
          (obs as any).scored = false;
          obs.setOrigin(0.5, isTop ? 0 : 1); // anchor from the edge it's spawned against
          obs.setFlipY(isTop); // mirror vertically only when hanging from the top
          obs.setDepth(2); // above clouds (-1) and below the debug overlay (999), same layer as the plane
          // Scaled with everything else, so the gap it leaves the plane is
          // always the same FRACTION of the play area's height — the difficulty
          // is a proportion, not a pixel count.
          obs.setScale(BASE.obstacleScale * s);

          const body = obs.body as Phaser.Physics.Arcade.Body;
          body.setAllowGravity(false);
          body.setImmovable(true);
          body.setVelocityX(-speed);

          // Safety cleanup, but now based on how far this obstacle actually
          // has to travel to reach the left despawn point (x: -100, matched
          // in update()) at its own speed — plus a buffer — instead of a
          // flat guess. This guarantees it always survives long enough to
          // reach the left edge naturally, on any canvas width, no matter
          // how slow `speed` is set to.
          const travelDistance = this.W + OBS_MARGIN_RIGHT + Math.abs(BASE.obstacleDespawnX * s);
          const safetyMs = (travelDistance / speed) * 1000 + 1000; // +1s buffer
          this.time.delayedCall(safetyMs, () => {
            if (obs.active) obs.destroy();
          });
        }

        spawnCloud() {
          const s = this.s;
          const key = Phaser.Math.Between(0, 1) === 0 ? "cloud1" : "cloud2";
          const y = Phaser.Math.Between(this.cloudSpawnY.min, this.cloudSpawnY.max);
          const scale = Phaser.Math.FloatBetween(0.1, 0.2) * s;
          const speed = Phaser.Math.Between(BASE.cloudSpeedMin, BASE.cloudSpeedMax) * s;

          // How far off each edge clouds spawn/despawn — widen these to
          // push the cloud lane further left and right beyond the visible
          // canvas. Kept as shared constants so the debug box below always
          // matches the actual travel distance.
          const MARGIN_RIGHT = BASE.cloudMargin * s;
          const MARGIN_LEFT = BASE.cloudMargin * s;

          const cloud = this.add.image(this.W + MARGIN_RIGHT, y, key);
          cloud.setScale(scale);
          cloud.setDepth(-1); // behind the plane and everything else
          cloud.setAlpha(0.4);
          this.clouds.add(cloud);

          const distance = this.W + MARGIN_RIGHT + MARGIN_LEFT;
          const durationMs = (distance / speed) * 1000;
          const GAP_AFTER_MS = 1000; // ← pause after one cloud finishes before the next spawns

          this.tweens.add({
            targets: cloud,
            x: -MARGIN_LEFT,
            duration: durationMs,
            ease: "Linear",
            onComplete: () => {
              cloud.destroy();
              // Only schedule the NEXT cloud once this one is fully done —
              // that's what guarantees only one is ever on screen at a
              // time, regardless of how slow `speed` makes any individual
              // cloud's crossing.
              this.time.delayedCall(GAP_AFTER_MS, () => this.spawnCloud());
            },
          });
        }


        update(time: number, delta: number) {
            // Destroy obstacles once they've fully exited the left side —
            // runs even before the game has started so none pile up.
            this.obstacles.getChildren().forEach((child) => {
              const o = child as Phaser.Physics.Arcade.Sprite;
              if (!o.active) return;

              if (!(o as any).scored && o.x < this.plane.x) {
                (o as any).scored = true;
                this.score += 1;
                this.scoreText.setText(String(this.score));

                if (this.score > this.highScore) {
                  this.highScore = this.score;
                  this.highScoreText.setText(`BEST: ${this.highScore}`);
                  localStorage.setItem("planeGameHighScore", String(this.highScore));
                }
              }

              if (o.x < BASE.obstacleDespawnX * this.s) o.destroy();
            });

            if (!this.isStarted || this.isGameOver) return;

            const body = this.plane.body as Phaser.Physics.Arcade.Body;
            // dt in seconds, so thrust is tunable in px/sec² just like world
            // gravity — both live in BASE and both are multiplied by the same
            // scale, which is what keeps the plane's arc identical in shape and
            // duration however large the canvas is.
            const s = this.s;
            const THRUST_ACCEL = BASE.thrustAccel * s;
            const MAX_RISE_SPEED = BASE.maxRiseSpeed * s; // most negative (upward) velocity allowed

            if (this.isThrusting) {
                const dt = delta / 1000;
                const newVelY = body.velocity.y - THRUST_ACCEL * dt;
                body.setVelocityY(Math.max(newVelY, MAX_RISE_SPEED));
            }

            // GD ship-style rotation: angle is a direct, continuous function
            // of current vertical velocity every frame — no separate tilt
            // state, no lerping toward a fixed pose. Moving up fast → nose
            // tilts up; falling fast → nose tilts down. This is what gives
            // the smooth, springy rotation feel rather than a snappy flap.
            const ROTATION_FACTOR = 0.05; // ← how many degrees per px/sec of velocity — raise for more dramatic tilt
            const MAX_ANGLE = 30; // ← clamp so it can't rotate past a sane nose-up/down extreme
            /* An angle is not a length, so it must NOT scale — but the velocity
               it is derived from now does. Dividing the scale back out is what
               keeps the tilt identical: on a quarter-size canvas the plane
               moves at a quarter of the speed, and without this it would fly
               almost perfectly level all the way down. */
            const targetAngle = Phaser.Math.Clamp(
              (body.velocity.y / s) * ROTATION_FACTOR,
              -MAX_ANGLE,
              MAX_ANGLE
            );

            // Still smoothed (not instant) so it doesn't visually snap frame
            // to frame — this is the "damping" the writeup mentions, applied
            // as an easing factor toward the velocity-derived target instead
            // of toward a fixed constant.
            this.plane.angle = Phaser.Math.Linear(this.plane.angle, targetAngle, 0.15);
        }
      }

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width,
        height,
        transparent: true,
        scale: {
          // React owns the size (it measures the torn frame and calls
          // scale.resize), so Phaser must not also try to fit the parent —
          // the two would fight over the same canvas.
          mode: Phaser.Scale.NONE,
          autoCenter: Phaser.Scale.NO_CENTER,
        },
        // The starting gravity; layout() rescales it to the real canvas size as
        // soon as the scene is up, and again on every resize.
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: BASE.gravity },
            debug: false
          }
        },
        scene: MainScene,
      });
    })();

    return () => {
      destroyed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
    // width/height intentionally omitted from deps below — see note in the
    // integration guide about resizing an already-running game instead of
    // tearing it down every time the frame's measured size changes slightly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep an already-running game in sync with layout changes without
  // destroying/recreating it (avoids a flicker every time gameframe.png's
  // measured size shifts by a pixel on resize).
  useEffect(() => {
    gameRef.current?.scale?.resize(width, height);
  }, [width, height]);

  return <div ref={containerRef} style={{ width, height }} />;
}