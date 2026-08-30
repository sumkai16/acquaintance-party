import type { Metadata } from "next";
import { Anton, DM_Sans } from "next/font/google";
import { EVENT } from "@/lib/config/event";
import "./globals.css";

// Display face: heavy condensed grotesque, the closest free match to a
// festival lineup poster. Anton ships a single weight.
const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Body face: plain and readable underneath the display type.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: EVENT.name,
  description: `${EVENT.tagline} · ${EVENT.host}`,
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
