import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { PseoPage, SiteTheme } from '@/types/pseo';
import { buildSiteFiles, type SiteMeta } from '@/lib/builder';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: unknown;
      pages?: unknown;
      theme?: unknown;
      topic?: unknown;
      title?: unknown;
      description?: unknown;
      heroHeadline?: unknown;
      heroSubheadline?: unknown;
    };

    let slug = typeof body.slug === 'string' ? body.slug : '';
    if (!slug) {
      return NextResponse.json(
        { error: 'slug가 필요합니다.', step: 'build' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.pages) || body.pages.length === 0) {
      return NextResponse.json(
        { error: 'pages 배열이 비어있습니다.', step: 'build' },
        { status: 400 }
      );
    }

    if (typeof body.theme !== 'object' || body.theme === null) {
      return NextResponse.json(
        { error: 'theme 객체가 필요합니다.', step: 'build' },
        { status: 400 }
      );
    }

    // 슬러그 중복 방지 — suffix 추가
    const sitePath = path.join(process.cwd(), 'public', 'sites', `${slug}.json`);
    if (fs.existsSync(sitePath)) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const pages = body.pages as PseoPage[];
    const theme = body.theme as SiteTheme;
    const baseDomain = process.env.BASE_DOMAIN ?? 'linoranex.com';

    const meta: SiteMeta = {
      topic: typeof body.topic === 'string' ? body.topic : undefined,
      title: typeof body.title === 'string' ? body.title : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      heroHeadline: typeof body.heroHeadline === 'string' ? body.heroHeadline : undefined,
      heroSubheadline: typeof body.heroSubheadline === 'string' ? body.heroSubheadline : undefined,
    };

    const { files, sitemapUrl, siteUrl } = buildSiteFiles(slug, pages, theme, baseDomain, meta);

    return NextResponse.json({ files, slug, sitemapUrl, siteUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류';
    const errAny = error as Error & { minRequired?: number; actual?: number };
    if (errAny.minRequired !== undefined) {
      return NextResponse.json(
        { error: message, minRequired: errAny.minRequired, actual: errAny.actual, step: 'build' },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: message, step: 'build' },
      { status: 500 }
    );
  }
}
