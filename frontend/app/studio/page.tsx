"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

import { scriptApi, renderApi, ttsApi, mediaApi, analyzeApi } from "@/lib/api";
import type { ScriptResult, RenderStatus, TTSVoice, ShortClip } from "@/lib/types";
import { MusicPicker } from "@/components/MusicPicker";
import { VoicePicker } from "@/components/VoicePicker";
import { SceneCard } from "@/components/SceneCard";
import {
  Lightning,
  ArrowRight,
  FilmSlate,
  DownloadSimple,
  SpinnerGap,
  Monitor,
  DeviceMobile,
  Square,
  Warning,
  Image as ImageIcon,
  MagicWand,
  Play,
  Pause,
  X,
} from "@phosphor-icons/react";

const FALLBACK_MUSIC: Record<string, string> = {
  upbeat: "https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3",
  calm: "https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3",
  dramatic: "https://assets.mixkit.co/music/preview/mixkit-cinematic-mystery-303.mp3",
  educational: "https://assets.mixkit.co/music/preview/mixkit-a-very-happy-christmas-897.mp3",
};


type RatioOption = { label: string; value: string; icon: any };
const RATIOS: RatioOption[] = [
  { label: "16:9 يوتيوب", value: "16:9", icon: Monitor },
  { label: "9:16 ريلز/تيك توك", value: "9:16", icon: DeviceMobile },
  { label: "1:1 إنستاقرام", value: "1:1", icon: Square },
];

function StudioContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  // Multi-variant states
  const [variants, setVariants] = useState<ScriptResult[]>([]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [targetScenes, setTargetScenes] = useState<number>(25);
  const [targetDuration, setTargetDuration] = useState<number>(300);
  const [generatingVariants, setGeneratingVariants] = useState<boolean>(false);
  const [rewriteError, setRewriteError] = useState<string>("");

  const [script, setScript] = useState<ScriptResult | null>(null);
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("ar-SA-ZariyahNeural");
  const [selectedRatio, setSelectedRatio] = useState("16:9");
  const [addCaptions, setAddCaptions] = useState(true);
  const [activeScene, setActiveScene] = useState(0);
  const [renderStatus, setRenderStatus] = useState<RenderStatus | null>(null);
  const [rendering, setRendering] = useState(false);
  const [loading, setLoading] = useState(true);

  // Music states
  const [musicMood, setMusicMood] = useState<string>("none");
  const [musicVolume, setMusicVolume] = useState<number>(0.15);

  // Media search and substitution states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingMedia, setSearchingMedia] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [downloadingFile, setDownloadingFile] = useState(false);

  // Thumbnails generated state
  const [thumbnails, setThumbnails] = useState<any[]>([]);
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false);

  // Preview slideshow states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewAudioUrls, setPreviewAudioUrls] = useState<string[]>([]);
  const [currentPreviewScene, setCurrentPreviewScene] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewMusicRef = useRef<HTMLAudioElement>(null);


  // Sync searchQuery when activeScene or script changes
  useEffect(() => {
    if (script && script.scenes[activeScene]) {
      const scene = script.scenes[activeScene];
      const q = scene.search_query || scene.keywords?.join(", ") || "";
      setSearchQuery(q);
      setSearchResults([]); 
    }
  }, [activeScene, script]);

  const handleSearchMedia = async () => {
    if (!searchQuery.trim()) return;
    setSearchingMedia(true);
    try {
      const res = await mediaApi.search({
        query: searchQuery,
        orientation: selectedRatio === "9:16" ? "portrait" : "landscape",
      });
      if (res && res.clips) {
        setSearchResults(res.clips);
      }
    } catch (err) {
      console.error("Failed to search media:", err);
    } finally {
      setSearchingMedia(false);
    }
  };

  const handleGenerateThumbnails = async () => {
    if (!id || !script) return;
    setGeneratingThumbnails(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://yousef891238-088098.hf.space"}/api/thumbnail/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: id,
          title: script.title,
        }),
      });
      const data = await res.json();
      if (data.thumbnails) {
        setThumbnails(data.thumbnails);
      }
    } catch (e) {
      console.error("Thumbnail generation failed:", e);
    } finally {
      setGeneratingThumbnails(false);
    }
  };

  const handleDownloadVideo = async (url: string, filename: string) => {
    setDownloadingFile(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Failed to download video blob:", err);
      window.open(url, "_blank");
    } finally {
      setDownloadingFile(false);
    }
  };

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearPollTimeout = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (!id) return;

    const init = async () => {
      try {
        const [projectData, voicesData] = await Promise.all([
          analyzeApi.get(id),
          ttsApi.getVoices(),
        ]);

        if (mountedRef.current) {
          setVoices(voicesData.voices);
          
          // Pre-fill settings
          const dur = projectData.duration || 300;
          setTargetDuration(dur);
          
          // Automatically pick edge Arabic voice if language is Arabic
          if (projectData.language === "ar" || projectData.language === "ar-en") {
            setSelectedVoice("ar-SA-ZariyahNeural");
          } else {
            setSelectedVoice("af_heart");
          }

          // Calculate correct scenes
          const sceneFreq = projectData.scene_frequency || "medium";
          const sceneDur = sceneFreq === "high" ? 7 : sceneFreq === "low" ? 22 : 12;
          const scenesCount = Math.min(Math.max(3, Math.floor(dur / sceneDur)), 30);
          setTargetScenes(scenesCount);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };
    init();

    return () => {
      mountedRef.current = false;
      clearPollTimeout();
    };
  }, [id]);

  const handleGenerateVariants = async () => {
    if (!id) return;
    setGeneratingVariants(true);
    setRewriteError("");
    try {
      const res = await scriptApi.rewriteVariants({
        project_id: id,
        target_scenes: targetScenes,
        target_duration: targetDuration,
        text_density: "medium",
        orientation: selectedRatio === "9:16" ? "portrait" : "landscape",
      });
      if (res && res.variants && res.variants.length > 0) {
        setVariants(res.variants);
        setScript(res.variants[0]);
        setSelectedVariantIndex(0);
        setActiveScene(0);
      } else {
        throw new Error("لم ترجع خوادم الذكاء الاصطناعي أي نتائج");
      }
    } catch (err: any) {
      console.error(err);
      setRewriteError(err.message || "فشل توليد السكريبتات. تأكد من إعداد جيميناي بنجاح.");
    } finally {
      setGeneratingVariants(false);
    }
  };

  const handleStartPreview = async () => {
    if (!script || !script.scenes.length) return;
    setShowPreviewModal(true);
    setPreviewLoading(true);
    setPreviewProgress(0);
    setPreviewPlaying(false);
    setCurrentPreviewScene(0);

    const urls: string[] = [];
    try {
      for (let i = 0; i < script.scenes.length; i++) {
        setPreviewProgress(i + 1);
        const scene = script.scenes[i];
        // Request TTS from backend
        const res = await ttsApi.generate(scene.text, selectedVoice);
        // Prepend backend base URL
        const fullAudioUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://yousef891238-088098.hf.space"}${res.audio_url}`;
        urls.push(fullAudioUrl);
      }
      setPreviewAudioUrls(urls);
      setPreviewLoading(false);
      setPreviewPlaying(true);
    } catch (err) {
      console.error("Preview preparation failed:", err);
      alert("فشل تحضير الملفات الصوتية للمعاينة، يرجى المحاولة مجدداً.");
      setShowPreviewModal(false);
    }
  };

  // Preview elements synchronization
  useEffect(() => {
    if (showPreviewModal && !previewLoading && previewAudioUrls.length > 0) {
      if (previewPlaying) {
        previewAudioRef.current?.play().catch(() => {});
        previewVideoRef.current?.play().catch(() => {});
        previewMusicRef.current?.play().catch(() => {});
      } else {
        previewAudioRef.current?.pause();
        previewVideoRef.current?.pause();
        previewMusicRef.current?.pause();
      }
    }
  }, [previewPlaying, showPreviewModal, previewLoading, currentPreviewScene, previewAudioUrls]);

  // Adjust volume of background music
  useEffect(() => {
    if (previewMusicRef.current) {
      previewMusicRef.current.volume = (musicVolume / 100) * 0.15;
    }
  }, [musicVolume, previewPlaying, showPreviewModal, previewLoading]);

  const handleRender = async () => {
    if (!script || !id) return;
    setRendering(true);
    clearPollTimeout();

    try {
      const { job_id } = await renderApi.start({
        project_id: id,
        scenes: script.scenes.map((s) => ({
          id: s.id,
          video_url: s.video_url || "",
          text: s.text,
          duration: s.duration,
        })),
        voice_id: selectedVoice,
        format: selectedRatio,
        add_captions: addCaptions,
        caption_style: "tiktok",
        music_mood: musicMood,
        music_volume: musicVolume,
      });

      const poll = async () => {
        if (!mountedRef.current) return;
        try {
          const status = await renderApi.getStatus(job_id);
          if (!mountedRef.current) return;
          setRenderStatus(status);

          if (status.status === "done" || status.status === "failed") {
            setRendering(false);
            if (status.status === "done") {
              // Trigger thumbnails generation after video render succeeds
              handleGenerateThumbnails();
            }
            return;
          }

          pollTimeoutRef.current = setTimeout(poll, 4000);
        } catch (err) {
          if (!mountedRef.current) return;
          pollTimeoutRef.current = setTimeout(poll, 6000);
        }
      };

      poll();

    } catch (err) {
      console.error(err);
      if (mountedRef.current) {
        setRendering(false);
      }
    }
  };

  if (!id) {
    return (
      <div className="text-center py-20 text-zinc-400 flex-1 flex flex-col items-center justify-center bg-[#0A0A0F]">
        <Warning size={40} className="mb-4 text-amber-500" />
        <p>لم يتم تحديد معرف المشروع</p>
        <Link href="/" className="btn-primary mt-4">
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0A0A0F]">
        <SpinnerGap size={32} className="text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0A0A0F] flex flex-col font-sans overflow-hidden">
      {/* Navbar */}
      <nav className="h-16 border-b border-white/5 bg-[#0D0D15]/90 backdrop-blur-xl shrink-0 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2">
          <Lightning size={18} weight="fill" className="text-violet-400" />
          <span className="text-sm font-bold text-white">VisionFlow Studio</span>
        </div>

        <div className="flex items-center gap-3">
          {renderStatus?.status === "done" && renderStatus.output_url ? (
            <button
              onClick={() => {
                const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://yousef891238-088098.hf.space"}${renderStatus.output_url}`;
                handleDownloadVideo(fullUrl, `video_full_${id.slice(0, 6)}.mp4`);
              }}
              disabled={downloadingFile}
              className="btn-primary py-2 px-5 text-sm flex items-center gap-2"
            >
              {downloadingFile ? (
                <>
                  <SpinnerGap size={14} className="animate-spin" />
                  جاري تنزيل الملف...
                </>
              ) : (
                <>
                  <DownloadSimple size={14} weight="fill" />
                  تحميل الفيديو النهائي
                </>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              {variants.length > 0 && (
                <button
                  onClick={handleStartPreview}
                  disabled={rendering || !script?.scenes.length}
                  className="py-2 px-4 text-xs font-semibold rounded-lg bg-white/5 border border-white/8 text-zinc-300 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
                >
                  <Play size={12} weight="fill" />
                  معاينة وتجربة الفيديو 👁️
                </button>
              )}

              <button
                onClick={handleRender}
                disabled={rendering || !script?.scenes.length}
                className="btn-primary py-2 px-5 text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {rendering ? (
                  <>
                    <SpinnerGap size={14} className="animate-spin" />
                    <span>{renderStatus?.message || "جاري المونتاج..."}</span>
                  </>
                ) : (
                  <>
                    <FilmSlate size={14} weight="fill" />
                    إنتاج ورندر الفيديو 🎬
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </nav>


      {/* Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {variants.length === 0 ? (
          /* Settings / Setup Panel */
          <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-lg mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <MagicWand size={32} weight="fill" />
            </div>
            <h2 className="text-xl font-bold text-white">إعادة صياغة السكربت بالذكاء الاصطناعي</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              سنقوم بإنشاء 3 خيارات ذكية ومختلفة للسكربت مع ربط الكليبات المناسبة ومستويات الانتشار.
            </p>

            <div className="w-full space-y-4 text-right">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">⏱️ مدة الفيديو الكلية (ثانية)</label>
                <input
                  type="number"
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(Number(e.target.value))}
                  className="w-full bg-[#12121A] border border-white/8 rounded-lg p-2.5 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">🎬 عدد المشاهد الإجمالي</label>
                <input
                  type="number"
                  value={targetScenes}
                  onChange={(e) => setTargetScenes(Number(e.target.value))}
                  className="w-full bg-[#12121A] border border-white/8 rounded-lg p-2.5 text-white text-xs"
                />
              </div>

              <button
                onClick={handleGenerateVariants}
                disabled={generatingVariants}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2 text-xs font-semibold disabled:opacity-50"
              >
                {generatingVariants ? (
                  <>
                    <SpinnerGap size={14} className="animate-spin" />
                    <span>جاري صياغة السكربتات وربط المشاهد...</span>
                  </>
                ) : (
                  "توليد السكربتات الذكية 🚀"
                )}
              </button>

              {rewriteError && <p className="text-red-400 text-xs text-center">{rewriteError}</p>}
            </div>
          </div>
        ) : (
          /* Editor Workspace */
          <>
            {/* Left Sidebar: Scenes list */}
            <div className="w-72 border-l border-white/5 bg-[#0D0D15]/80 overflow-y-auto shrink-0 flex flex-col">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">لقطات السكربت ({script?.scenes.length})</span>
              </div>
              <div className="p-3 space-y-2 flex-1">
                {script?.scenes.map((scene, i) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    index={i}
                    isActive={activeScene === i}
                    onClick={() => setActiveScene(i)}
                  />
                ))}
              </div>
            </div>

            {/* Center Area: Preview and Editing */}
            <div className="flex-1 flex flex-col bg-[#08080C] overflow-y-auto">
              {/* Variant selection */}
              <div className="w-full border-b border-white/5 p-4 flex items-center justify-between bg-[#0D0D15]/60 shrink-0">
                <div className="flex gap-2">
                  {variants.map((v, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedVariantIndex(idx);
                        setScript(v);
                        setActiveScene(0);
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        selectedVariantIndex === idx
                          ? "bg-violet-600 text-white"
                          : "bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      {v.style === "tiktok" ? "📱 تيك توك / Shorts" : v.style === "youtube" ? "📺 يوتيوب كلاسيكي" : "📖 سرد درامي قصصي"}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-zinc-500">النمط الفني للمحتوى</span>
              </div>

              {/* Preview and Search replacements */}
              {script && script.scenes[activeScene] ? (
                <div className="p-6 flex flex-col items-center w-full max-w-2xl mx-auto space-y-6">
                  {/* Video preview Box */}
                  <div
                    className={`relative bg-black rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border border-white/5 ${
                      selectedRatio === "9:16"
                        ? "w-[240px] h-[426px]"
                        : selectedRatio === "1:1"
                        ? "w-[340px] h-[340px]"
                        : "w-[480px] h-[270px]"
                    }`}
                  >
                    {renderStatus?.status === "done" && renderStatus.output_url ? (
                      <video
                        src={`${process.env.NEXT_PUBLIC_API_URL || "https://yousef891238-088098.hf.space"}${renderStatus.output_url}`}
                        controls
                        autoPlay
                        loop
                        className="w-full h-full object-contain"
                      />
                    ) : script.scenes[activeScene].video_url ? (
                      <>
                        <video
                          src={script.scenes[activeScene].video_url}
                          muted
                          autoPlay
                          loop
                          playsInline
                          className="w-full h-full object-cover opacity-80"
                        />
                        {addCaptions && (
                          <div className="absolute bottom-6 inset-x-4 text-center">
                            <div className="inline-block bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 max-w-full">
                              {script.scenes[activeScene].text}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center text-zinc-600">
                        <FilmSlate size={40} className="mx-auto mb-2 animate-pulse" />
                        <span className="text-xs">لا يوجد فيديو</span>
                      </div>
                    )}
                  </div>

                  {/* Scene content edit form */}
                  <div className="w-full bg-[#0D0D15]/80 border border-white/5 rounded-2xl p-5 text-right space-y-4 shadow-xl">
                    <h3 className="text-xs font-bold text-zinc-400">📝 تعديل نص التوقيت للمشهد الحالي</h3>
                    <textarea
                      value={script.scenes[activeScene].text}
                      onChange={(e) => {
                        const updated = [...script.scenes];
                        updated[activeScene].text = e.target.value;
                        setScript({ ...script, scenes: updated });
                      }}
                      rows={3}
                      className="w-full bg-[#12121A] border border-white/5 rounded-lg p-3 text-xs text-white placeholder-zinc-700 focus:outline-none focus:border-violet-600"
                    />

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <span className="text-[10px] text-zinc-500 block mb-1">⏱️ مدة اللقطة (ثانية)</span>
                        <input
                          type="number"
                          value={script.scenes[activeScene].duration}
                          onChange={(e) => {
                            const updated = [...script.scenes];
                            updated[activeScene].duration = Number(e.target.value);
                            setScript({ ...script, scenes: updated });
                          }}
                          className="w-full bg-[#12121A] border border-white/5 rounded-lg p-2 text-xs text-white"
                        />
                      </div>

                      <div className="flex-[2] flex gap-2 items-end">
                        <div className="flex-1">
                          <span className="text-[10px] text-zinc-500 block mb-1">🔍 محرك البحث الوصفي</span>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#12121A] border border-white/5 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                        <button
                          onClick={handleSearchMedia}
                          disabled={searchingMedia}
                          className="btn-primary py-2 px-4 text-xs font-semibold h-9 shrink-0 flex items-center justify-center gap-1.5"
                        >
                          {searchingMedia ? <SpinnerGap size={12} className="animate-spin" /> : "بحث وتعديل"}
                        </button>
                      </div>
                    </div>

                    {/* Stock results replacement */}
                    {searchResults.length > 0 && (
                      <div className="border-t border-white/5 pt-4">
                        <h4 className="text-[11px] font-bold text-zinc-400 mb-2">اضغط على الكليب المناسب للاستبدال:</h4>
                        <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                          {searchResults.map((clip, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                if (!script) return;
                                const updated = [...script.scenes];
                                updated[activeScene].video_url = clip.url;
                                updated[activeScene].video_thumb = clip.thumbnail;
                                updated[activeScene].video_source = clip.source;
                                setScript({ ...script, scenes: updated });
                                setSearchResults([]); 
                              }}
                              className="relative aspect-video rounded-lg overflow-hidden border border-white/10 hover:border-violet-500 transition-all group"
                            >
                              <img src={clip.thumbnail || "https://images.pexels.com/videos/853889/free-video-853889.jpg?auto=compress&cs=tinysrgb&h=630&fit=crop&w=1200"} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                <span className="text-[9px] text-white bg-violet-600 px-2 py-0.5 rounded-full font-bold">اختيار</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Render progress bar */}
                  {rendering && renderStatus && (
                    <div className="w-full bg-[#0D0D15]/80 border border-white/5 rounded-2xl p-5 text-right shadow-xl">
                      <div className="flex justify-between text-xs text-zinc-400 mb-2">
                        <span>{renderStatus.message || "جاري المونتاج..."}</span>
                        <span>{renderStatus.progress}%</span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-violet-600 to-cyan-500 h-full rounded-full transition-all duration-350"
                          style={{ width: `${renderStatus.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Post-Render Outputs (Shorts & Thumbnails) */}
                  {renderStatus?.status === "done" && (
                    <div className="w-full space-y-6 border-t border-white/5 pt-6 text-right">
                      {/* Shorts Generated */}
                      {renderStatus.shorts && renderStatus.shorts.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold text-violet-400 flex items-center gap-1.5 justify-end">
                            <span>📱 مقاطع Shorts عمودية جاهزة (أعلى تفاعل)</span>
                            <span>🔥</span>
                          </h3>
                          <div className="grid grid-cols-3 gap-3">
                            {renderStatus.shorts.map((short: any) => (
                              <div key={short.index} className="bg-[#0D0D15] border border-white/5 rounded-xl p-3 flex flex-col items-center gap-2">
                                <span className="text-[10px] text-zinc-500">مقطع #{short.index} - {short.duration}ث</span>
                                <span className="text-[10px] text-emerald-400 font-bold">نسبة تفاعل {short.virality_score}%</span>
                                <button
                                  onClick={() => {
                                    const fullUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://yousef891238-088098.hf.space"}${short.url}`;
                                    handleDownloadVideo(fullUrl, `short_${short.index}_${id.slice(0, 6)}.mp4`);
                                  }}
                                  className="btn-primary py-1 px-3 text-[10px] w-full justify-center"
                                >
                                  تحميل المقطع
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Thumbnails */}
                      {thumbnails.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <h3 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 justify-end">
                            <span>🖼️ صور مصغرة مقترحة (YouTube Thumbnails)</span>
                            <ImageIcon size={14} />
                          </h3>
                          <div className="grid grid-cols-3 gap-3">
                            {thumbnails.map((thumb: any) => (
                              <div key={thumb.index} className="bg-[#0D0D15] border border-white/5 rounded-xl p-2 flex flex-col gap-2">
                                <img src={thumb.base64} alt="" className="w-full aspect-video rounded-lg object-cover" />
                                <button
                                  onClick={() => {
                                    const a = document.createElement("a");
                                    a.href = thumb.base64;
                                    a.download = `thumbnail_${thumb.index}.png`;
                                    a.click();
                                  }}
                                  className="btn-primary py-1 px-3 text-[10px] justify-center"
                                >
                                  تنزيل الصورة
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-zinc-600 p-20 flex-1 flex items-center justify-center">
                  <p>الرجاء توليد السكربت لعرض المشاهد</p>
                </div>
              )}
            </div>

            {/* Right Sidebar: Render settings configuration */}
            <div className="w-72 border-r border-white/5 bg-[#0D0D15]/80 overflow-y-auto shrink-0 p-4 space-y-6">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block border-b border-white/5 pb-2">
                تكوين الفيديو
              </span>

              {/* 1. Format ratio */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 block">أبعاد العرض</label>
                <div className="space-y-1.5">
                  {RATIOS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setSelectedRatio(r.value)}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-xs transition-all ${
                        selectedRatio === r.value
                          ? "bg-violet-600/20 border border-violet-500/40 text-violet-300 font-bold"
                          : "border border-white/5 text-zinc-400 hover:border-white/10"
                      }`}
                    >
                      <r.icon size={14} />
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Voice settings */}
              <div>
                <VoicePicker
                  voices={voices}
                  selectedVoiceId={selectedVoice}
                  onVoiceChange={setSelectedVoice}
                />
              </div>

              {/* 3. Background music settings */}
              <div>
                <MusicPicker
                  selectedMood={musicMood}
                  onMoodChange={setMusicMood}
                  musicVolume={musicVolume}
                  onVolumeChange={setMusicVolume}
                />
              </div>

              {/* 4. Captions overlay toggle */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-400 block">الكابشنز</label>
                <button
                  onClick={() => setAddCaptions(!addCaptions)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-xs transition-all ${
                    addCaptions
                      ? "bg-violet-600/10 border-violet-600/30 text-violet-400 font-bold"
                      : "border-white/5 text-zinc-500"
                  }`}
                >
                  <span>كتابة نص الكابشن تلقائياً</span>
                  <div className={`w-8 h-4.5 rounded-full p-0.5 transition-colors ${addCaptions ? "bg-violet-600" : "bg-zinc-700"}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-all ${addCaptions ? "translate-x-3.5" : ""}`} />
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Preview Slideshow Modal */}
      <AnimatePresence>
        {showPreviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <div className="w-full max-w-lg bg-[#0D0D15] border border-white/10 rounded-2xl p-6 relative flex flex-col items-center gap-6 shadow-2xl text-right">
              
              {/* Close button */}
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewPlaying(false);
                }}
                className="absolute left-4 top-4 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <h2 className="text-md font-bold text-white w-full border-b border-white/5 pb-3">👁️ تجربة ومعاينة الفيديو قبل التصدير</h2>

              {previewLoading ? (
                /* Loading State */
                <div className="flex flex-col items-center justify-center py-12 space-y-4 w-full">
                  <SpinnerGap size={36} className="text-violet-400 animate-spin" />
                  <p className="text-sm font-semibold text-white">جاري تحضير التعليق الصوتي للمعاينة...</p>
                  <p className="text-xs text-zinc-500">
                    المشهد الحالي: {previewProgress} من {script?.scenes.length}
                  </p>
                  <div className="w-48 bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-violet-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(previewProgress / (script?.scenes.length || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                /* Player State */
                <div className="w-full flex flex-col items-center space-y-6">
                  {/* Video Player Box */}
                  <div
                    className={`relative bg-black rounded-xl overflow-hidden border border-white/5 shadow-inner flex items-center justify-center ${
                      selectedRatio === "9:16"
                        ? "w-[200px] h-[355px]"
                        : selectedRatio === "1:1"
                        ? "w-[280px] h-[280px]"
                        : "w-[400px] h-[225px]"
                    }`}
                  >
                    {script && script.scenes[currentPreviewScene] && (
                      <>
                        <video
                          src={script.scenes[currentPreviewScene].video_url || ""}
                          autoPlay={previewPlaying}
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                          ref={previewVideoRef}
                        />
                        {addCaptions && (
                          <div className="absolute bottom-6 inset-x-4 text-center z-10 pointer-events-none">
                            <div className="inline-block bg-black/85 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-white/10 max-w-full leading-relaxed shadow-lg">
                              {script.scenes[currentPreviewScene].text}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Scene Navigation controls */}
                  <div className="w-full flex items-center justify-between bg-white/3 border border-white/6 px-4 py-2.5 rounded-xl">
                    <span className="text-xs text-zinc-400 font-medium">
                      المشهد {currentPreviewScene + 1} من {script?.scenes.length}
                    </span>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (currentPreviewScene > 0) {
                            setCurrentPreviewScene(currentPreviewScene - 1);
                          }
                        }}
                        disabled={currentPreviewScene === 0}
                        className="text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        ◄ السابق
                      </button>

                      <button
                        onClick={() => setPreviewPlaying(!previewPlaying)}
                        className="w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center transition-all shadow-md"
                      >
                        {previewPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
                      </button>

                      <button
                        onClick={() => {
                          if (script && currentPreviewScene < script.scenes.length - 1) {
                            setCurrentPreviewScene(currentPreviewScene + 1);
                          }
                        }}
                        disabled={script ? currentPreviewScene === script.scenes.length - 1 : true}
                        className="text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        التالي ►
                      </button>
                    </div>
                  </div>

                  {/* Hidden Preview Audio element */}
                  {script && script.scenes[currentPreviewScene] && (
                    <audio
                      src={previewAudioUrls[currentPreviewScene]}
                      autoPlay={previewPlaying}
                      onEnded={() => {
                        if (currentPreviewScene < script.scenes.length - 1) {
                          setCurrentPreviewScene(currentPreviewScene + 1);
                        } else {
                          setPreviewPlaying(false);
                        }
                      }}
                      ref={previewAudioRef}
                    />
                  )}

                  {/* Hidden Background Music element */}
                  {musicMood !== "none" && (
                    <audio
                      src={FALLBACK_MUSIC[musicMood]}
                      autoPlay={previewPlaying}
                      loop
                      ref={previewMusicRef}
                    />
                  )}

                  {/* Export Trigger */}
                  <button
                    onClick={() => {
                      setShowPreviewModal(false);
                      setPreviewPlaying(false);
                      handleRender();
                    }}
                    className="w-full btn-primary py-3 font-semibold text-xs flex items-center justify-center gap-2"
                  >
                    <FilmSlate size={14} weight="fill" />
                    <span>تأكيد وإنتاج الفيديو النهائي الآن 🎬</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


export default function StudioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0A0A0F]">
        <SpinnerGap size={32} className="text-violet-400 animate-spin" />
      </div>
    }>
      <StudioContent />
    </Suspense>
  );
}