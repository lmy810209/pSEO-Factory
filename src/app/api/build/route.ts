import { NextRequest, NextResponse } from 'next/server';
import type { PseoPage, SiteTheme } from '@/types/pseo';
import { buildSiteFiles } from '@/lib/builder';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: unknown;
      pages?: unknown;
      theme?: unknown;
    };

    const slug = typeof body.slug === 'string' ? body.slug : '';
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

    const pages = body.pages as PseoPage[];
    const theme = body.theme as SiteTheme;
    const baseDomain = process.env.BASE_DOMAIN ?? 'linoranex.com';

    const { files, sitemapUrl, siteUrl } = buildSiteFiles(slug, pages, theme, baseDomain);

    return NextResponse.json({ files, slug, sitemapUrl, siteUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: message, step: 'build' },
      { status: 500 }
    );
  }
}
