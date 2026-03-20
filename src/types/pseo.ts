export interface PseoPage {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  content: {
    hero: string;
    sections: { heading: string; body: string }[];
    faq: { q: string; a: string }[];
  };
}

export interface PseoJob {
  id: string;
  topic: string;
  slug: string;
  subdomain: string;
  pages: PseoPage[];
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
  | 'done'
  | 'error';
