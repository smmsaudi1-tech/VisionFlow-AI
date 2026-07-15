import type { Metadata } from "next";
import {
  YoutubeLogo,
  Waveform,
  MagicWand,
  FilmSlate,
  SpeakerHigh,
  DownloadSimple,
  Globe,
  Robot,
  VideoCamera,
  Microphone,
  Scissors,
  ChartLineUp,
  Lightning,
  Sparkle,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import HeroInput from "@/components/HeroInput";
import Link from "next/link";

export const metadata: Metadata = {
  title: "VisionFlow-AI — إنتاج فيديو متكامل بالذكاء الاصطناعي",
  description:
    "حوّل أي فيديو يوتيوب أو نص إلى سكريبت وتصاميم وفيديو جديد بالكامل مع تعليق صوتي وموسيقى خلفية وكابشنز تلقائية.",
};

const STEPS = [
  {
    icon: YoutubeLogo,
    color: "#FF4444",
    num: "01",
    title: "رابط يوتيوب",
    desc: "الصق أي رابط فيديو — yt-dlp يجلب النص الأساسي خلال ثواني معدودة.",
  },
  {
    icon: Waveform,
    color: "#6C63FF",
    num: "02",
    title: "نسخ النص",
    desc: "استخراج تلقائي دقيق للمحتوى الصوتي بالكامل مع المخطط الزمني للمشاهد.",
  },
  {
    icon: MagicWand,
    color: "#00D9FF",
    num: "03",
    title: "Gemini AI",
    desc: "تحليل ذكي وإعادة صياغة لـ 3 خيارات سكربت جاهزة مع تحديد نقاط الانتشار والانتشار.",
  },
  {
    icon: FilmSlate,
    color: "#10B981",
    num: "04",
    title: "لقطات Stock",
    desc: "البحث التلقائي بجمل وصفية دقيقة عبر Pexels و Pixabay وتنزيل الكليبات المتطابقة.",
  },
  {
    icon: SpeakerHigh,
    color: "#F59E0B",
    num: "05",
    title: "معلق صوتي + موسيقى",
    desc: "دمج تعليق صوتي طبيعي (عربي/إنجليزي) وموسيقى خلفية تتلاءم مع وتيرة الفيديو.",
  },
  {
    icon: DownloadSimple,
    color: "#8B5CF6",
    num: "06",
    title: "رندر ومونتاج",
    desc: "تجميع نهائي باستخدام FFmpeg لدمج الكابشنز والمؤثرات وإنتاج Shorts وفيديو يوتيوب.",
  },
];

const FEATURES = [
  { icon: Globe, label: "عربي / إنجليزي / مختلط", color: "#6C63FF" },
  { icon: Robot, label: "Gemini 2.0 Flash AI", color: "#00D9FF" },
  { icon: VideoCamera, label: "فيديوهات Stock مجانية", color: "#10B981" },
  { icon: Microphone, label: "Edge TTS Arabic", color: "#F59E0B" },
  { icon: Scissors, label: "توليد Shorts تلقائي", color: "#EC4899" },
  { icon: ChartLineUp, label: "موسيقى خلفية ذكية", color: "#8B5CF6" },
];

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden relative">
      {/* Background orbs */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 border-b border-white/5 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
              <Lightning size={18} weight="fill" className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">VisionFlow-AI</span>
          </div>

          <div className="inline-flex items-center gap-3">
            <Link
              href="/montage"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all"
            >
              <Scissors size={13} weight="fill" />
              مونتاج
            </Link>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              <span>جاهز للاستخدام</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-600/10 border border-violet-600/20 text-violet-300 text-xs font-semibold mb-8">
            <Star size={14} weight="fill" />
            توليد فيديو احترافي كامل بالذكاء الاصطناعي
          </div>

          <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            حوّل أي فيديو <span className="text-gradient">يوتيوب</span>
            <br />
            إلى محتوى جديد بالكامل
          </h1>

          <p className="text-md md:text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            استخرج النص التلقائي، واصنع 3 مسودات مختلفة للسكربت، واختر المعلق الصوتي الملائم وموسيقى الخلفية مع كابشنز ورندر متكامل مجاناً.
          </p>

          <HeroInput />

          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/3 border border-white/5 text-xs text-zinc-300 shadow-sm"
              >
                <f.icon size={13} weight="fill" style={{ color: f.color }} />
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-t border-white/5 bg-[#0D0D15]/40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">كيف تعمل المنصة؟</h2>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              ست خطوات مؤتمتة تجمع بين جلب الكليبات، توليد الأصوات الطبيعية، والرندر النهائي.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <div key={step.num} className="glass-card p-6 group relative text-right">
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                    style={{
                      background: `${step.color}15`,
                      border: `1px solid ${step.color}25`,
                    }}
                  >
                    <step.icon size={22} weight="fill" style={{ color: step.color }} />
                  </div>
                  <span className="font-mono text-2xl font-black text-zinc-700/40">
                    {step.num}
                  </span>
                </div>

                <h3 className="text-md font-bold mb-2 text-zinc-200">{step.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center">
              <Lightning size={14} weight="fill" className="text-white" />
            </div>
            <span className="text-sm font-semibold">VisionFlow-AI</span>
          </div>
          <p className="text-xs text-zinc-500">
            Powered by Next.js + FastAPI + Gemini + Kokoro TTS + Edge Neural + FFmpeg
          </p>
        </div>
      </footer>
    </main>
  );
}
