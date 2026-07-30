"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ThemeValue = { dark: boolean; toggle: () => void };

const ThemeContext = createContext<ThemeValue>({ dark: false, toggle: () => {} });

/* Day/night for the whole site. The only thing this does is put `.dark` on
   <html> — every colour in globals.css is a variable that hangs off that class,
   so one toggle repaints every surface at once.

   Deliberately not persisted: the sun is a thing you pull in the hero, and
   restoring night on load would either flash the page white first or need a
   render-blocking script in <head>. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);
  const value = useMemo(() => ({ dark, toggle }), [dark, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
