import type { Metadata } from "next";
import "./globals.css";
import SmoothScroll from '@/app/components/SmoothScroll';

export const metadata: Metadata = {
  title: "Your Name | Portfolio",
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
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}