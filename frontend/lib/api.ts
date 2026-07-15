import type {
  AnalysisResult,
  ScriptVariantsResponse,
  VideoClip,
  TTSVoice,
  RenderStatus,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://yousef891238-088098.hf.space";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

export const analyzeApi = {
  /** Start YouTube video analysis */
  start: (
    url: string,
    language = "auto",
    target_duration = 300,
    text_density = "medium",
    scene_frequency = "medium"
  ) =>
    request<{ project_id: string; status: string; message: string }>("/api/analyze", {
      method: "POST",
      body: JSON.stringify({
        url,
        language,
        target_duration,
        text_density,
        scene_frequency,
      }),
    }),

  /** Get analysis results by project ID */
  get: (projectId: string) => request<AnalysisResult>(`/api/analyze/${projectId}`),

  /** Start custom script analysis */
  startScript: (
    script_text: string,
    language = "ar",
    target_duration = 300,
    text_density = "medium",
    scene_frequency = "medium"
  ) =>
    request<{ project_id: string; status: string; message: string }>("/api/analyze/script", {
      method: "POST",
      body: JSON.stringify({
        script_text,
        language,
        target_duration,
        text_density,
        scene_frequency,
      }),
    }),
};


export const scriptApi = {
  /** Rewrite script into 3 variants using Gemini AI */
  rewriteVariants: (params: {
    project_id: string;
    language?: string;
    target_duration?: number;
    target_scenes?: number;
    text_density?: string;
    orientation?: string;
  }) =>
    request<ScriptVariantsResponse>("/api/script/variants", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};

export const mediaApi = {
  /** Search for stock video clips */
  search: (params: { query: string; orientation?: string; limit?: number }) =>
    request<{ clips: VideoClip[] }>(
      `/api/media/search?query=${encodeURIComponent(params.query)}&orientation=${params.orientation || "landscape"}&limit=${params.limit || 8}`
    ),
};

export const ttsApi = {
  /** List available voices */
  getVoices: () => request<{ voices: TTSVoice[] }>("/api/tts/voices"),
  /** Generate TTS voice over from text */
  generate: (text: string, voice: string, speed = 1.0) =>
    request<{ audio_url: string; duration: number; voice: string }>("/api/tts/generate", {
      method: "POST",
      body: JSON.stringify({ text, voice, speed }),
    }),
};


export const renderApi = {
  /** Start render job */
  start: (params: {
    project_id: string;
    scenes: Array<{
      id: number;
      video_url: string;
      text: string;
      duration: number;
    }>;
    voice_id: string;
    music_mood: string;
    music_volume: number;
    format: string;
    add_captions: boolean;
    caption_style: string;
  }) =>
    request<{ job_id: string; status: string; message: string }>("/api/render", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /** Get render status */
  getStatus: (jobId: string) => request<RenderStatus>(`/api/render/status/${jobId}`),

  /** Poll until render is done */
  poll: async (
    jobId: string,
    onProgress?: (status: RenderStatus) => void,
    intervalMs = 4000
  ): Promise<RenderStatus> => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const status = await renderApi.getStatus(jobId);
          onProgress?.(status);

          if (status.status === "done") {
            clearInterval(interval);
            resolve(status);
          } else if (status.status === "failed") {
            clearInterval(interval);
            reject(new Error(status.message || "Render failed"));
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, intervalMs);
    });
  },
};
