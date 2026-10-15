import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const font = Public_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "maxycrawljob: Lowongan Kerja dan Magang Terkurasi",
  description:
    "Rangkuman lowongan kerja dan magang dari Kalibrr, Dealls, Greenhouse, Lever, Remotive, Arbeitnow, dan Remote OK. Cepat, ringkas, dan langsung ke sumber asli.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={font.className}>
      <body>{children}</body>
    </html>
  );
}
