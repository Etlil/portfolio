"use client";
import { useEffect, useRef } from "react";

// Keep these in sync with the sprite sheet used by PlaneTransition.tsx
const FLIP_COLS = 3;
const FLIP_ROWS = 3;
const FLIP_FRAME_W = 640; // native size of ONE frame in flip.png (edit to match your actual sheet)
const FLIP_FRAME_H = 640;

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
        cloudSpawnY = { min: 20, max: 0 }; // max gets set in create() once `height` is known in scope

        obstacles!: Phaser.Physics.Arcade.Group;
        obstacleTimer!: Phaser.Time.TimerEvent;
        isGameOver = false;
        gameOverText!: Phaser.GameObjects.Text;

        score = 0;
        scoreText!: Phaser.GameObjects.Text;
        highScore = 0;
        highScoreText!: Phaser.GameObjects.Text;

        preload() {
          this.load.spritesheet("plane", "/flip.png", {
            frameWidth: FLIP_FRAME_W,
            frameHeight: FLIP_FRAME_H,
          });
          this.load.image("cloud1", "/cloud1.png");
          this.load.image("cloud2", "/cloud2.png");
          this.load.image("obs", "/obs.png");
          this.load.svg("backIcon", "/back.svg", { width: 24, height: 24 });
        }

        create() {
          this.isGameOver = false;
          this.isStarted = false;
          this.isThrusting = false;

          this.physics.resume();
          this.physics.world.setBounds(0, 0, width, height);

          const PLANE_SIZE = 110; // ← keep in sync with PLANE_GAME_SIZE in PlaneTransition.tsx
          const startX = 50 + (PLANE_SIZE / 2);
          const startY = 150 + (PLANE_SIZE / 2);
          this.plane = this.physics.add.sprite(startX, startY, "plane", startFrame);
          this.plane.setDisplaySize(PLANE_SIZE, PLANE_SIZE);
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

          // Visual debug outline for the cloud spawn band — purely a dev
          // aid, drawn once and never interacted with. Delete this whole
          // graphics block once you're happy with the spawn area and don't
          // need to see it anymore.
          this.cloudSpawnY.max = height * 0.4;

          this.startText = this.add.text(width / 2, height / 2 + 60, "CLICK TO START", {
          fontFamily: "monospace", fontSize: "20px", color: "#000000"}).setOrigin(0.5);

          this.gameOverText = this.add.text(width / 2, height / 2, "CLICK TO RESTART", {
            fontFamily: "monospace", fontSize: "22px", color: "#000000",
          }).setOrigin(0.5).setDepth(1000).setVisible(false);

          this.score = 0;
          this.scoreText = this.add.text(width / 2, 20, "0", {
            fontFamily: "monospace", fontSize: "24px", color: "#000000",
          }).setOrigin(0.5, 0).setDepth(1000);

          this.highScore = Number(localStorage.getItem("planeGameHighScore") || 0);
          this.highScoreText = this.add.text(width / 2, 50, `BEST: ${this.highScore}`, {
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

          const backBtn = this.add
            .image(10, 10, "backIcon")
            .setOrigin(0, 0)
            .setDepth(1000)
            .setInteractive({ useHandCursor: true });

          backBtn.on("pointerdown", (pointer: any, localX: any, localY: any, event: any) => {
            event.stopPropagation();
            onExitRef.current();
            });

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
            const TAP_IMPULSE = -300; // ← send tap strength here (more negative = stronger tap)
            const body = this.plane.body as Phaser.Physics.Arcade.Body;
            body.setVelocityY(Math.max(body.velocity.y + TAP_IMPULSE, -420));
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

          const OBS_MARGIN_RIGHT = 60
          const speed = 160; // px/sec — obstacle travel speed, separate from cloud speed
          const isTop = Phaser.Math.Between(0, 1) === 0;

          // Fixed distance in from whichever edge it's anchored to — tweak
          // these two if obstacles should sit closer to/further from the
          // top and bottom edges of the play area.
          const EDGE_OFFSET = 1;
          const y = isTop ? EDGE_OFFSET : height - EDGE_OFFSET;

          const obs = this.obstacles.create(width + OBS_MARGIN_RIGHT, y, "obs") as Phaser.Physics.Arcade.Sprite;
          (obs as any).scored = false;
          obs.setOrigin(0.5, isTop ? 0 : 1); // anchor from the edge it's spawned against
          obs.setFlipY(isTop); // mirror vertically only when hanging from the top
          obs.setDepth(2); // above clouds (-1) and below the debug overlay (999), same layer as the plane
          obs.setScale(0.4); // 20% smaller than the previous 0.5

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
          const travelDistance = width + OBS_MARGIN_RIGHT + 100;
          const safetyMs = (travelDistance / speed) * 1000 + 1000; // +1s buffer
          this.time.delayedCall(safetyMs, () => {
            if (obs.active) obs.destroy();
          });
        }

        spawnCloud() {
          const key = Phaser.Math.Between(0, 1) === 0 ? "cloud1" : "cloud2";
          const y = Phaser.Math.Between(this.cloudSpawnY.min, this.cloudSpawnY.max);
          const scale = Phaser.Math.FloatBetween(0.1, 0.2);
          const speed = Phaser.Math.Between(70, 71); // px/sec, randomized so clouds don't all move in lockstep

          // How far off each edge clouds spawn/despawn — widen these to
          // push the cloud lane further left and right beyond the visible
          // canvas. Kept as shared constants so the debug box below always
          // matches the actual travel distance.
          const MARGIN_RIGHT = 150; // ← was 60
          const MARGIN_LEFT = 150;  // ← was 60

          const cloud = this.add.image(width + MARGIN_RIGHT, y, key);
          cloud.setScale(scale);
          cloud.setDepth(-1); // behind the plane and everything else
          cloud.setAlpha(0.4);
          this.clouds.add(cloud);

          const distance = width + MARGIN_RIGHT + MARGIN_LEFT;
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

              if (o.x < -100) o.destroy();
            });

            if (!this.isStarted || this.isGameOver) return;

            const body = this.plane.body as Phaser.Physics.Arcade.Body;
            // dt in seconds, so THRUST_ACCEL is tunable in px/sec² just like
            // world gravity (1000) — bump this number up/down to make
            // holding feel stronger/weaker relative to gravity.
            const THRUST_ACCEL = 1800;
            const MAX_RISE_SPEED = -420; // most negative (upward) velocity allowed

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
            const targetAngle = Phaser.Math.Clamp(body.velocity.y * ROTATION_FACTOR, -MAX_ANGLE, MAX_ANGLE);

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
        physics: { 
          default: "arcade", 
          arcade: { 
            gravity: { x: 0, y: 1000 }, 
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