import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from '@/app/components/SmoothScroll';
import { ThemeProvider } from '@/app/components/Theme';
import Ambience from '@/app/components/Ambience';

export const metadata: Metadata = {
  title: "Etlil's Portfolio",
  description: "Professional portfolio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          {/* Sky, darkness and everything that flies — fixed layers behind and
              over the page, mounted once for the whole site. */}
          <Ambience />
          <SmoothScroll>{children}</SmoothScroll>
        </ThemeProvider>
      </body>
    </html>
  );
}