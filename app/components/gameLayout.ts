/* ── HOW BIG IS THE GAME? ──

   The paper plane's flight ends by handing off between two completely separate
   renderers: a CSS sprite flown by requestAnimationFrame (PlaneTransition) and
   a Phaser sprite in a <canvas> (GameCanvas). For the handoff to be invisible,
   both have to agree — to the pixel — on how large the plane is and where in
   the play area it sits. That agreement lives here, so neither file can drift
   from the other.

   Everything in the game was tuned against one play area, and it is that
   ORIGINAL tuning that this file preserves at every other size. A single scale
   factor is derived from the real play area, and every length in the game is
   quoted as a multiple of it: the plane, its start position, the obstacles, the
   type, the back button — and, crucially, the physics.

   Scaling the physics is what makes the game the same game on a phone. Gravity,
   thrust and speed are all lengths per unit of time, so scaling them by the
   same factor as the geometry leaves every trajectory similar in the geometric
   sense: the arc the plane flies has the same SHAPE and takes the same TIME on
   a 320px canvas as on a 1000px one, it is just drawn smaller. Scale the
   picture and not the physics and you get the opposite — a phone-sized canvas
   where the plane falls its own height in a blink and no human reflex is fast
   enough.

   The reference below is roughly a laptop's play area, and the scale is capped
   at 1, so nothing about the game changes on the large screens it was built on.
   The floor stops a very small window from shrinking the plane into a speck. */

export const GAME_REF_W = 1000;
export const GAME_REF_H = 720;

/** The plane's size and top-left corner within the play area, at scale 1. */
export const PLANE_BASE_SIZE = 110;
export const PLANE_BASE_LEFT = 50;
export const PLANE_BASE_TOP = 150;

const MIN_SCALE = 0.25;
const MAX_SCALE = 1;

/** One number that every length in the game is a multiple of. */
export function gameScale(width: number, height: number): number {
  if (!width || !height) return MAX_SCALE;
  const s = Math.min(width / GAME_REF_W, height / GAME_REF_H);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Where the plane sits when the flight ends and the game begins. Both the CSS
 *  plane and the Phaser plane are placed from this, which is what makes the
 *  swap between them invisible. */
export function planeLayout(width: number, height: number) {
  const scale = gameScale(width, height);
  return {
    scale,
    size: PLANE_BASE_SIZE * scale,
    left: PLANE_BASE_LEFT * scale,
    top: PLANE_BASE_TOP * scale,
  };
}
