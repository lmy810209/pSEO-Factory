import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { PseoPage, SiteTheme } from '@/types/pseo';

interface SiteData {
  slug: string;
  pages: PseoPage[];
  theme: SiteTheme;
  generatedAt: number;
}

export async function GET() {
  try {
    const sitesDir = path.join(process.cwd(), 'public', 'sites');
    if (!fs.existsSync(sitesDir)) {
      return NextResponse.json({ sites: [] });
    }

    const files = fs.readdirSync(sitesDir).filter((f) => f.endsWith('.json'));
    const sites: SiteData[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(sitesDir, file), 'utf-8');
        sites.push(JSON.parse(content) as SiteData);
      } catch { /* skip invalid */ }
    }

    sites.sort((a, b) => b.generatedAt - a.generatedAt);
    return NextResponse.json({ sites });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
