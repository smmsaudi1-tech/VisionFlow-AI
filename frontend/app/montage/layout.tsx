import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مونتاج — كليبات جاهزة للنشر | VisionFlow-AI",
  description:
    "الصق رابط فيديو أو ارفع ملف — الذكاء الاصطناعي يلاقي أحسن اللحظات، يقيّمها، ويقصّها كليبات عمودية جاهزة للنشر.",
  keywords: [
    "مونتاج تلقائي",
    "كليبات قصيرة",
    "يوتيوب شورتس",
    "تيك توك",
    "ذكاء اصطناعي",
    "clip detection",
  ],
};

export default function MontageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
