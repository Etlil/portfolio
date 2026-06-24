'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { frame } from 'framer-motion';

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    });

    function update({ timestamp }: { timestamp: number }) {
      lenis.raf(timestamp);
    }

    frame.update(update, true);

    return () => {
      frame.update(update, false);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}