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
  --grad-dir: ${theme.gradientDirection};
  --font-heading: '${heading}', 'Noto Sans KR', sans-serif;
  --font-body: '${body}', 'Noto Sans KR', sans-serif;
}
h1,h2,h3,h4,h5 { font-family: var(--font-heading); }
body,p,li,span,a { font-family: var(--font-body); }
@media (max-width: 640px) {
  .hero-title { font-size: 1.75rem !important; }
  .hero-sub { font-size: 1rem !important; }
}
      `,
      }}
    />
  );
}

function JsonLd({ page, siteUrl }: { page: PseoPage; siteUrl: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description: page.description,
    url: siteUrl,
    datePublished: new Date().toISOString().split('T')[0],
    dateModified: new Date().toISOString().split('T')[0],
    author: { '@type': 'Organization', name: 'pSEO Factory' },
    publisher: {
      '@type': 'Organization',
      name: 'pSEO Factory',
      logo: { '@type': 'ImageObject', url: `${siteUrl}/favicon.ico` },
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
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = getSiteData(slug);
  if (!data || data.pages.length === 0) return {};
  const page = data.pages[0];
  return {
    title: page.title,
    description: page.description,
    openGraph: { title: page.title, description: page.description },
    keywords: page.keywords,
  };
}

export default async function SubdomainPage({ params }: Props) {
  const { slug } = await params;
  const data = getSiteData(slug);
  if (!data || data.pages.length === 0) notFound();

  const { theme } = data;
  const indexPage = data.pages[0];
  const baseDomain = process.env.BASE_DOMAIN ?? 'linoranex.com';
  const siteUrl = `https://${slug}.${baseDomain}`;
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  const mapQuery = indexPage.content.mapQuery;

  return (
    <>
      <ThemeStyle theme={theme} />
      <JsonLd page={indexPage} siteUrl={siteUrl} />
      <main className="min-h-screen bg-white text-gray-900">
        {/* Hero */}
        <section
          style={{
            background: `linear-gradient(${theme.gradientDirection}, ${theme.primaryColor}, ${theme.secondaryColor})`,
          }}
          className="text-white py-20 px-6"
        >
          <div className="max-w-4xl mx-auto text-center">
            <h1
              className="hero-title font-bold mb-6"
              style={{ fontSize: 'clamp(1.75rem, 5vw, 3rem)' }}
            >
              {indexPage.title}
            </h1>
            <p
              className="hero-sub max-w-2xl mx-auto leading-relaxed"
              style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', opacity: 0.9 }}
            >
              {indexPage.content.hero}
            </p>
          </div>
        </section>

        {/* Keywords */}
        <section className="py-6 border-b bg-gray-50">
          <div className="max-w-4xl mx-auto px-6 flex flex-wrap gap-2 justify-center">
            {indexPage.keywords.map((kw) => (
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
        <section className="py-14 px-6">
          <div className="max-w-4xl mx-auto space-y-10">
            {indexPage.content.sections.map((section, i) => (
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
        {mapsKey && mapQuery && (
          <section className="py-8 px-6 bg-gray-50">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-bold mb-4" style={{ color: theme.primaryColor }}>
                지도
              </h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(mapQuery)}&zoom=13&size=800x400&maptype=roadmap&key=${mapsKey}`}
                alt={`${mapQuery} 지도`}
                className="w-full rounded-xl shadow"
              />
            </div>
          </section>
        )}

        {/* Other pages nav */}
        {data.pages.length > 1 && (
          <section className="py-12 px-6 bg-gray-50">
            <div className="max-w-4xl mx-auto">
              <h2
                className="text-2xl font-bold mb-6 text-center"
                style={{ color: theme.primaryColor }}
              >
                더 알아보기
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.pages.slice(1).map((page) => (
                  <a
                    key={page.slug}
                    href={`/${page.slug}`}
                    className="block p-5 bg-white rounded-xl border-2 transition-all hover:shadow-lg"
                    style={{ borderColor: theme.primaryColor }}
                  >
                    <h3 className="font-semibold text-gray-800 mb-1">{page.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{page.description}</p>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        {indexPage.content.faq.length > 0 && (
          <section className="py-14 px-6">
            <div className="max-w-4xl mx-auto">
              <h2
                className="text-2xl font-bold mb-8 text-center"
                style={{ color: theme.primaryColor }}
              >
                자주 묻는 질문
              </h2>
              <div className="space-y-3">
                {indexPage.content.faq.map((item, i) => (
                  <details
                    key={i}
                    className="rounded-xl overflow-hidden border"
                    style={{ borderColor: `${theme.primaryColor}30` }}
                  >
                    <summary
                      className="px-6 py-4 cursor-pointer font-medium text-gray-800 hover:opacity-90"
                      style={{ backgroundColor: `${theme.primaryColor}10` }}
                    >
                      {item.q}
                    </summary>
                    <p className="px-6 py-4 text-gray-600 bg-white">{item.a}</p>
                  </details>
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
              © {new Date().getFullYear()} {indexPage.title}. Powered by pSEO Factory.
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
