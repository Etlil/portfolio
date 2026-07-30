"use client";

/* The darkness, and nothing else.

   One fixed sheet laid over the whole finished page, so every pixel dims by the
   same amount and no surface needs a night colour of its own. Nothing on the site is recoloured or inverted, which is what keeps torn
   edges, filtered PNGs and paper textures consistent with each other.

   It sits at 9998, one below the navbar, so the header always covers it.

   The moon, the stars and the fireflies shine THROUGH it by sharing that exact
   z-index: equal z-index is resolved by document order, and this component is
   rendered before the page content in layout.tsx, so anything in the page that
   also asks for 9998 paints on top of the sheet — while the navbar at 9999 still
   covers all of it. That's how they can be above the darkness and under the
   header at the same time.

   Because the header ends up above the sheet, it dims itself instead: see
   `.nav-night` in Navbar.tsx. */
export default function Ambience() {
  return (
    <div
      className="amb-dark"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        /* Over the page, one under the navbar — so the header is never touched.
           The text climbs back over this by asking for the same 9998 and winning
           on document order; see the note in globals.css. */
        zIndex: 9998,
      }}
    />
  );
}
