import type { PseoPage, SiteTheme } from '@/types/pseo';

function validatePage(page: PseoPage, index: number): void {
  const check = (field: string, value: string | undefined) => {
    if (!value || value.trim() === '') {
      throw new Error(
        `pages[${index}].${field} 이(가) 없거나 비어있습니다. SEO 필수값 검증 실패.`
      );
    }
  };
  check('title', page.title);
  check('description', page.description);
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
      return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

function generateRobotsTxt(slug: string, baseDomain: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: https://${slug}.${baseDomain}/sitemap.xml`,
  ].join('\n');
}

export interface BuildResult {
  files: Record<string, string>;
  sitemapUrl: string;
  siteUrl: string;
}

export function buildSiteFiles(
  slug: string,
  pages: PseoPage[],
  theme: SiteTheme,
  baseDomain: string
): BuildResult {
  // SEO 필수 메타태그 검증 — 하나라도 없으면 빌드 중단
  for (let i = 0; i < pages.length; i++) {
    validatePage(pages[i], i);
  }

  const sitemap = generateSitemap(slug, pages, baseDomain);
  if (!sitemap) throw new Error('sitemap 생성 실패');

  const robotsTxt = generateRobotsTxt(slug, baseDomain);
  const siteUrl = `https://${slug}.${baseDomain}`;
  const sitemapUrl = `${siteUrl}/sitemap.xml`;

  const siteJson = JSON.stringify(
    { slug, pages, theme, generatedAt: Date.now() },
    null,
    2
  );

  const files: Record<string, string> = {
    [`public/sites/${slug}.json`]: siteJson,
    [`public/sitemaps/${slug}.xml`]: sitemap,
    [`public/robots/${slug}.txt`]: robotsTxt,
  };

  return { files, sitemapUrl, siteUrl };
}
