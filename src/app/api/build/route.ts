import { NextRequest, NextResponse } from 'next/server';
import type { PseoPage } from '@/types/pseo';

export const maxDuration = 30;

function validatePage(page: PseoPage, index: number): void {
  const check = (field: string, value: string | undefined) => {
    if (!value || value.trim() === '') {
      throw new Error(
        `pages[${index}].${field} 이(가) 없거나 비어있습니다. SEO 필수값 검증 실패.`
      );
    }
  };
  // title, description은 og:title, og:description으로도 사용
  check('title', page.title);
  check('description', page.description);
  // og: 검증 (title/description을 og로 사용)
  check('og:title (title)', page.title);
  check('og:description (description)', page.description);
}

function generateSitemap(slug: string, pages: PseoPage[], baseDomain: string): string {
  const baseUrl = `https://${slug}.${baseDomain}`;
  const urls = pages
    .map((page) => {
      const loc =
        page.slug === 'index' || page.slug === slug
          ? baseUrl
          : `${baseUrl}/${page.slug}`;
      return `  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: unknown;
      pages?: unknown;
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

    const pages = body.pages as PseoPage[];
    const baseDomain = process.env.BASE_DOMAIN ?? 'igeol.kr';

    // SEO 필수 메타태그 검증 — 하나라도 없으면 빌드 중단
    for (let i = 0; i < pages.length; i++) {
      validatePage(pages[i], i);
    }

    // sitemap.xml 생성
    const sitemap = generateSitemap(slug, pages, baseDomain);

    // sitemap 누락 시 배포 단계로 진행하지 않음
    if (!sitemap) {
      return NextResponse.json(
        { error: 'sitemap 생성 실패', step: 'build' },
        { status: 500 }
      );
    }

    // GitHub에 커밋할 파일 목록 반환
    const files: Record<string, string> = {
      [`public/sites/${slug}.json`]: JSON.stringify(
        { slug, pages, generatedAt: Date.now() },
        null,
        2
      ),
      [`public/sitemaps/${slug}.xml`]: sitemap,
    };

    return NextResponse.json({ files, slug });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: message, step: 'build' },
      { status: 500 }
    );
  }
}
