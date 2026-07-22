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

        preload() {
          this.load.spritesheet("plane", "/flip.png", {
            frameWidth: FLIP_FRAME_W,
            frameHeight: FLIP_FRAME_H,
          });
          this.load.image("cloud1", "/cloud1.png");
          this.load.image("cloud2", "/cloud2.png");
        }

        create() {
          this.physics.world.setBounds(0, 0, width, height);

          const startX = 50 + (160 / 2);
          const startY = 150 + (160 / 2);
          this.plane = this.physics.add.sprite(startX, startY, "plane", startFrame);
          this.plane.setDisplaySize(160, 160);
          this.plane.setDepth(1); // explicit: always above clouds (-1), regardless of add order

          this.plane.setCollideWorldBounds(true);
          (this.plane.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

          this.clouds = this.add.group();

          // Visual debug outline for the cloud spawn band — purely a dev
          // aid, drawn once and never interacted with. Delete this whole
          // graphics block once you're happy with the spawn area and don't
          // need to see it anymore.
          this.cloudSpawnY.max = height * 0.4;
          const spawnAreaDebug = this.add.graphics();
          spawnAreaDebug.lineStyle(2, 0xff00ff, 0.6);
          spawnAreaDebug.strokeRect(
            -150, // matches MARGIN_LEFT in spawnCloud()
            this.cloudSpawnY.min,
            width + 300, // matches MARGIN_RIGHT + MARGIN_LEFT in spawnCloud()
            this.cloudSpawnY.max - this.cloudSpawnY.min
          );
          // Extra reference lines marking the full canvas's bottom and
          // right edges, separate from the cloud band box above — useful
          // for seeing the whole play area's boundary at a glance.
          spawnAreaDebug.lineStyle(2, 0x00ffff, 0.6);
          spawnAreaDebug.lineBetween(0, height, width, height); // bottom edge
          spawnAreaDebug.lineBetween(width, 0, width, height);  // right edge
          spawnAreaDebug.setDepth(999); // always on top so it's visible over clouds/plane

          this.spawnCloud(); // one immediately so it's not empty on load
          this.cloudTimer = this.time.addEvent({
            delay: 3000, // ← how often a new cloud spawns, independent of how long each one takes to cross
            callback: () => this.spawnCloud(),
            loop: true,
          });

          this.startText = this.add.text(width / 2, height / 2 + 60, "CLICK TO START", {
          fontFamily: "monospace", fontSize: "20px", color: "#7a5c4e"}).setOrigin(0.5);
          this.plane.setDamping(true);
          this.plane.setDrag(0.9);
          // Shrink the hitbox to 100x60 pixels and center it
          this.plane.setBodySize(400, 240); 
          // Offset the hitbox if it's not centered on the plane art
          this.plane.setOffset(70, 170);

          this.input.on("pointerdown", () => this.startThrust());
          this.input.on("pointerup", () => this.stopThrust());
          this.input.on("pointerout", () => this.stopThrust());
          this.input.keyboard!.on("keydown-SPACE", () => this.startThrust());
          this.input.keyboard!.on("keyup-SPACE", () => this.stopThrust());

          const backBtn = this.add
            .text(width - 10, 10, "← back", {
              fontFamily: "monospace",
              fontSize: "14px",
              color: "#7a5c4e",
            })
            .setOrigin(1, 0)
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
            if (!this.isStarted) {
                this.isStarted = true;
                this.startText.setVisible(false);
                (this.plane.body as Phaser.Physics.Arcade.Body).setAllowGravity(true);
                onStart(); // Notify React that the game has started
            }
            this.isThrusting = true;
            const TAP_IMPULSE = -300; // ← send tap strength here (more negative = stronger tap)
            const body = this.plane.body as Phaser.Physics.Arcade.Body;
            body.setVelocityY(Math.max(body.velocity.y + TAP_IMPULSE, -420));
        }

        stopThrust() {
            this.isThrusting = false;
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
            if (!this.isStarted) return;

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

            // Tilt up while thrusting, tilt down while falling — same nose
            // feel as before, just driven off velocity instead of a
            // one-shot flap.
            if (this.isThrusting) {
                this.plane.angle = Phaser.Math.Linear(this.plane.angle, -20, 0.2);
            } else if (body.velocity.y > 0 && this.plane.angle < 30) {
                this.plane.angle += 2;
            }
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
            debug: true,
            debugShowBody: true,
            debugShowVelocity: true
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