import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const font = Public_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "maxycrawljob: lowongan dan magang",
  description: "Lowongan kerja dan magang dari API publik Greenhouse, Lever, Remotive, Arbeitnow, dan Remote OK.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={font.className}>
      <body>{children}</body>
    </html>
  );
}
