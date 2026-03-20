import { NextRequest, NextResponse } from 'next/server';
import { submitToSearchEngines } from '@/lib/searchconsole';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: unknown;
      siteUrl?: unknown;
      sitemapUrl?: unknown;
    };

    const slug = typeof body.slug === 'string' ? body.slug : '';
    if (!slug) {
      return NextResponse.json(
        { error: 'slug가 필요합니다.', step: 'index' },
        { status: 400 }
      );
    }

    const baseDomain = process.env.BASE_DOMAIN ?? 'linoranex.com';
    const siteUrl =
      typeof body.siteUrl === 'string'
        ? body.siteUrl
        : `https://${slug}.${baseDomain}`;
    const sitemapUrl =
      typeof body.sitemapUrl === 'string'
        ? body.sitemapUrl
        : `${siteUrl}/sitemap.xml`;

    // 키가 없으면 skip — 파이프라인 중단 금지
    const result = await submitToSearchEngines(siteUrl, sitemapUrl);

    return NextResponse.json({
      slug,
      siteUrl,
      sitemapUrl,
      google: result.google,
      naver: result.naver,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: message, step: 'index' },
      { status: 500 }
    );
  }
}
