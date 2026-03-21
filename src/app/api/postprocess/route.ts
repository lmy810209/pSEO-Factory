import { NextRequest, NextResponse } from 'next/server';
import { submitToSearchEngines } from '@/lib/searchconsole';

// 후처리 전용 엔드포인트 — 배포 완료 후 클라이언트가 fire-and-forget으로 호출
// 내부링크·지도는 렌더 타임에 JSON에서 읽으므로 여기서는 인덱싱만 처리
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: unknown;
      siteUrl?: unknown;
      sitemapUrl?: unknown;
      pageUrls?: unknown;
    };

    const slug = typeof body.slug === 'string' ? body.slug : '';
    if (!slug) {
      return NextResponse.json({ error: 'slug가 필요합니다.', step: 'postprocess' }, { status: 400 });
    }

    const baseDomain = process.env.BASE_DOMAIN ?? 'linoranex.com';
    const siteUrl = typeof body.siteUrl === 'string' ? body.siteUrl : `https://${slug}.${baseDomain}`;
    const sitemapUrl = typeof body.sitemapUrl === 'string' ? body.sitemapUrl : `${siteUrl}/sitemap.xml`;
    const pageUrls = Array.isArray(body.pageUrls)
      ? (body.pageUrls as unknown[]).filter((u): u is string => typeof u === 'string')
      : [];

    const result = await submitToSearchEngines(siteUrl, sitemapUrl, pageUrls);

    return NextResponse.json({ slug, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message, step: 'postprocess' }, { status: 500 });
  }
}
