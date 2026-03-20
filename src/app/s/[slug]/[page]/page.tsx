import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import type { PseoPage, SiteTheme } from '@/types/pseo';

interface SiteData {
  slug: string;
  pages: PseoPage[];
  theme: SiteTheme;
  generatedAt: number;
}

function getSiteData(slug: string): SiteData | null {
  const filePath = path.join(process.cwd(), 'public', 'sites', `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SiteData;
  } catch {
    return null;
  }
}

function encodeFontName(name: string): string {
  return name.replace(/ /g, '+');
}

function ThemeStyle({ theme }: { theme: SiteTheme }) {
  const { heading, body } = theme.fontPair;
  const fontQuery = `family=${encodeFontName(heading)}:wght@600;700;800&family=${encodeFontName(body)}:wght@400;500&display=swap`;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
@import url('https://fonts.googleapis.com/css2?${fontQuery}');
:root {
  --primary: ${theme.primaryColor};
  --secondary: ${theme.secondaryColor};
  --accent: ${theme.accentColor};
  --font-heading: '${heading}', 'Noto Sans KR', sans-serif;
  --font-body: '${body}', 'Noto Sans KR', sans-serif;
}
h1,h2,h3,h4,h5 { font-family: var(--font-heading); }
body,p,li,span,a { font-family: var(--font-body); }
      `,
      }}
    />
  );
}

function JsonLd({
  page,
  pageUrl,
}: {
  page: PseoPage;
  pageUrl: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description: page.description,
    url: pageUrl,
    datePublished: new Date().toISOString().split('T')[0],
    dateModified: new Date().toISOString().split('T')[0],
    author: { '@type': 'Organization', name: 'pSEO Factory' },
    publisher: {
      '@type': 'Organization',
      name: 'pSEO Factory',
      logo: { '@type': 'ImageObject', url: `${pageUrl}/favicon.ico` },
    },
    keywords: page.keywords.join(', '),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

interface Props {
  params: Promise<{ slug: string; page: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page: pageSlug } = await params;
  const data = getSiteData(slug);
  if (!data) return {};
  const page = data.pages.find((p) => p.slug === pageSlug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    openGraph: { title: page.title, description: page.description },
    keywords: page.keywords,
  };
}

export default async function SubdomainSubPage({ params }: Props) {
  const { slug, page: pageSlug } = await params;
  const data = getSiteData(slug);
  if (!data) notFound();

  const pageIndex = data.pages.findIndex((p) => p.slug === pageSlug);
  if (pageIndex === -1) notFound();
  const page = data.pages[pageIndex];

  const { theme } = data;
  const baseDomain = process.env.BASE_DOMAIN ?? 'linoranex.com';
  const siteUrl = `https://${slug}.${baseDomain}`;
  const pageUrl = `${siteUrl}/${page.slug}`;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

  // 추가 6: 관련 글 — 현재 페이지 제외, 최대 5개
  const relatedPages = data.pages
    .filter((_, i) => i !== pageIndex)
    .slice(0, 5);

  return (
    <>
      <ThemeStyle theme={theme} />
      <JsonLd page={page} pageUrl={pageUrl} />
      <main className="min-h-screen bg-white text-gray-900">
        {/* Breadcrumb */}
        <nav className="bg-gray-50 border-b px-6 py-3">
          <div className="max-w-4xl mx-auto text-sm text-gray-500">
            <a href="/" className="hover:underline" style={{ color: theme.primaryColor }}>
              홈
            </a>
            <span className="mx-2">/</span>
            <span className="text-gray-800">{page.title}</span>
          </div>
        </nav>

        {/* Hero */}
        <section
          style={{
            background: `linear-gradient(${theme.gradientDirection}, ${theme.primaryColor}, ${theme.secondaryColor})`,
          }}
          className="text-white py-16 px-6"
        >
          <div className="max-w-4xl mx-auto">
            <h1
              className="font-bold mb-4"
              style={{ fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}
            >
              {page.title}
            </h1>
            <p style={{ opacity: 0.9 }} className="text-lg leading-relaxed">
              {page.content.hero}
            </p>
          </div>
        </section>

        {/* Keywords */}
        <section className="py-5 bg-gray-50 border-b">
          <div className="max-w-4xl mx-auto px-6 flex flex-wrap gap-2">
            {page.keywords.map((kw) => (
              <span
                key={kw}
                className="px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: theme.accentColor }}
              >
                {kw}
              </span>
            ))}
          </div>
        </section>

        {/* Sections */}
        <section className="py-12 px-6">
          <div className="max-w-4xl mx-auto space-y-10">
            {page.content.sections.map((section, i) => (
              <div key={i}>
                <h2
                  className="text-2xl font-bold mb-3"
                  style={{ color: theme.primaryColor }}
                >
                  {section.heading}
                </h2>
                <p className="text-gray-600 leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Google Static Map (추가 5) */}
        {mapsKey && page.content.mapQuery && (
          <section className="py-8 px-6 bg-gray-50">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-bold mb-4" style={{ color: theme.primaryColor }}>
                지도
              </h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(page.content.mapQuery)}&zoom=13&size=800x400&maptype=roadmap&key=${mapsKey}`}
                alt={`${page.content.mapQuery} 지도`}
                className="w-full rounded-xl shadow"
              />
            </div>
          </section>
        )}

        {/* FAQ */}
        {page.content.faq.length > 0 && (
          <section className="py-12 px-6 bg-gray-50">
            <div className="max-w-4xl mx-auto">
              <h2
                className="text-2xl font-bold mb-6"
                style={{ color: theme.primaryColor }}
              >
                자주 묻는 질문
              </h2>
              <div className="space-y-3">
                {page.content.faq.map((item, i) => (
                  <details
                    key={i}
                    className="rounded-xl overflow-hidden border bg-white"
                    style={{ borderColor: `${theme.primaryColor}30` }}
                  >
                    <summary
                      className="px-5 py-4 cursor-pointer font-medium text-gray-800 hover:opacity-90"
                      style={{ backgroundColor: `${theme.primaryColor}10` }}
                    >
                      {item.q}
                    </summary>
                    <p className="px-5 py-4 text-gray-600">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 추가 6: 관련 글 내부 링크 */}
        {relatedPages.length > 0 && (
          <section className="py-12 px-6">
            <div className="max-w-4xl mx-auto">
              <h2
                className="text-xl font-bold mb-5"
                style={{ color: theme.primaryColor }}
              >
                관련 글
              </h2>
              <div className="space-y-3">
                {relatedPages.map((related) => (
                  <a
                    key={related.slug}
                    href={related.slug === data.pages[0].slug ? '/' : `/${related.slug}`}
                    className="flex items-start gap-3 p-4 rounded-lg border hover:shadow-md transition-shadow bg-white"
                    style={{ borderColor: `${theme.primaryColor}20` }}
                  >
                    <span
                      className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                    <div>
                      <p className="font-medium text-gray-800">{related.title}</p>
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                        {related.keywords.slice(0, 3).join(' · ')}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        <footer
          className="py-8 px-6 border-t"
          style={{ borderColor: `${theme.primaryColor}30` }}
        >
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-sm mb-3" style={{ color: theme.primaryColor }}>
              © {new Date().getFullYear()} Powered by pSEO Factory.
            </p>
            <p className="text-center text-xs text-gray-400 mb-3">
              본 콘텐츠는 정보 제공 목적으로만 제공됩니다. 2026년 3월 기준 작성 내용으로 실제 상황과 다를 수 있습니다.
            </p>
            <div className="flex justify-center gap-4 text-xs" style={{ color: theme.primaryColor }}>
              <a href="/about" className="hover:underline">사이트 소개</a>
              <span>·</span>
              <a href="/privacy" className="hover:underline">개인정보 처리방침</a>
              <span>·</span>
              <a href="/contact" className="hover:underline">문의하기</a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
