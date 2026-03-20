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
