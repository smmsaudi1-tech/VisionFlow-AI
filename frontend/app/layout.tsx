import type { Metadata } from "next";
import { Outfit, Cairo } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VisionFlow-AI — إنتاج فيديو متكامل بالذكاء الاصطناعي",
  description:
    "حوّل أي فيديو يوتيوب أو نص إلى فيديو احترافي مع تعليق صوتي وموسيقى خلفية وكابشنز تلقائية بدقائق معدودة.",
  keywords: ["AI video creator", "توليد فيديو", "يوتيوب لسكربت", "تحويل النص لفيديو", "Edge TTS عربي"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>" />
      </head>
      <body
        className={`${outfit.variable} ${cairo.variable} font-sans bg-[#0A0A0F] text-[#F4F4F5] antialiased`}
        style={{ fontFamily: "var(--font-cairo), var(--font-outfit), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
