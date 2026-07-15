export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface AnalysisResult {
  project_id: string;
  status: "processing" | "done" | "failed";
  title: string;
  thumbnail: string;
  duration: number;
  transcript_text: string;
  transcript_segments: TranscriptSegment[];
  summary: string;
  keywords: string[];
  hashtags: string[];
  content_type: string;
  language: string;
  best_hook: string;
  scene_frequency?: string;
  error?: string;
}


export interface ScriptScene {
  id: number;
  text: string;
  duration: number;
  virality_score: number;
  search_query: string;
  keywords: string[];
  video_url?: string;
  video_thumb?: string;
  video_source?: string;
}

export interface ScriptResult {
  style: string;
  title: string;
  description: string;
  hashtags: string[];
  scenes: ScriptScene[];
}

export interface ScriptVariantsResponse {
  project_id: string;
  variants: ScriptResult[];
}

export interface VideoClip {
  id: string;
  url: string;
  thumbnail: string;
  source: string;
  duration: number;
  width: number;
  height: number;
}

export interface TTSVoice {
  id: string;
  name: string;
  lang: string;
  gender: string;
  engine: string;
}

export interface ShortClip {
  index: number;
  url: string;
  scene_id: number;
  duration: number;
  virality_score: number;
}

export interface RenderStatus {
  job_id: string;
  status: "processing" | "done" | "failed";
  progress: number;
  message: string;
  output_url?: string;
  shorts: ShortClip[];
  duration?: number;
}
