// Site-level data stored in public/sites/{slug}.json
export interface SiteData {
  slug: string;
  topic?: string;           // 원본 입력 주제
  title?: string;           // 사이트 SEO 제목 (허브 메타)
  description?: string;     // 사이트 메타 설명 (허브 메타)
  heroHeadline?: string;    // 허브 H1 — 사이트 주제 직접 반영
  heroSubheadline?: string; // 허브 부제목 — 전체 사이트 소개
  pages: PseoPage[];
  theme: SiteTheme;
  generatedAt: number;
}

export interface PseoPage {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  content: {
    hero: string;
    sections: { heading: string; body: string }[];
    faq: { q: string; a: string }[];
    mapQuery?: string;
  };
}

export interface SiteTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  gradientDirection: string;
  mood: 'cheerful' | 'natural' | 'calm' | 'energetic';
  fontPair: {
    heading: string;
    body: string;
  };
}

export interface PseoJob {
  id: string;
  topic: string;
  slug: string;
  subdomain: string;
  pages: PseoPage[];
  theme: SiteTheme;
  status: PipelineStatus;
  createdAt: number;
  deployUrl?: string;
  error?: { step: string; message: string };
}

export type PipelineStatus =
  | 'idle'
  | 'generating'
  | 'building'
  | 'deploying'
  | 'connecting'
  | 'indexing'
  | 'done'
  | 'error';
