import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import type { PseoPage, SiteTheme, SiteData } from '@/types/pseo';

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

/** 기존 사이트 마이그레이션: heroHeadline이 없으면 slug를 읽기 좋은 형태로 */
function deriveHeadline(data: SiteData): string {
  if (data.heroHeadline) return data.heroHeadline;
  // slug → title case (영문 fallback)
  return data.slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function deriveSubheadline(data: SiteData): string {
  if (data.heroSubheadline) return data.heroSubheadline;
  if (data.description) return data.description;
  return `${data.pages.length}개의 상황별 가이드로 완벽 정리했습니다. 아래에서 원하는 테마를 선택하세요.`;
}

/** 페이지 카테고리 태그 추출 */
function getCategory(page: PseoPage): string {
  const text = (page.title + ' ' + (page.keywords ?? []).join(' ')).toLowerCase();
  if (/top5|top 5|핵심|총정리|대표|필수/.test(text)) return 'TOP5';
  if (/가족|어린이|아이|키즈|어린이날/.test(text)) return '가족';
  if (/데이트|연인|커플|로맨틱/.test(text)) return '데이트';
  if (/사진|인증샷|포토존|sns|감성/.test(text)) return '사진';
  if (/교통|주차|접근|대중교통|버스|지하철/.test(text)) return '교통';
  if (/혼자|솔로|혼행|1인/.test(text)) return '혼행';
  if (/야경|야간|저녁|밤|빛/.test(text)) return '야경';
  if (/맛집|카페|먹거리|음식|식당/.test(text)) return '맛집';
  if (/가성비|저예산|무료|절약|알뜰/.test(text)) return '가성비';
  if (/시니어|어르신|노인|실버/.test(text)) return '시니어';
  if (/계절|봄|여름|가을|겨울|당일|주말/.test(text)) return '코스';
  return '가이드';
}

const CATEGORY_ORDER = ['TOP5', '가족', '데이트', '사진', '교통', '혼행', '야경', '맛집', '가성비', '시니어', '코스', '가이드'];

function sortPagesByCategory(pages: PseoPage[]): PseoPage[] {
  return [...pages].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(getCategory(a));
    const bi = CATEGORY_ORDER.indexOf(getCategory(b));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

/** 카테고리별 배경색 */
function getCategoryStyle(category: string, primaryColor: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    'TOP5':   { bg: '#fef3c7', text: '#92400e' },
    '가족':   { bg: '#dcfce7', text: '#166534' },
    '데이트': { bg: '#fce7f3', text: '#9d174d' },
    '사진':   { bg: '#ede9fe', text: '#5b21b6' },
    '교통':   { bg: '#e0f2fe', text: '#0c4a6e' },
    '혼행':   { bg: '#f0fdf4', text: '#14532d' },
    '야경':   { bg: '#1e1b4b', text: '#c7d2fe' },
    '맛집':   { bg: '#fff7ed', text: '#9a3412' },
    '가성비': { bg: '#f0fdf4', text: '#166534' },
    '시니어': { bg: '#f8fafc', text: '#475569' },
    '코스':   { bg: '#ecfdf5', text: '#065f46' },
  };
  return map[category] ?? { bg: `${primaryColor}15`, text: primaryColor };
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

function JsonLdWebSite({ data, siteUrl }: { data: SiteData; siteUrl: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: data.title ?? deriveHeadline(data),
    description: data.description ?? deriveSubheadline(data),
    url: siteUrl,
    datePublished: new Date().toISOString().split('T')[0],
    dateModified: new Date().toISOString().split('T')[0],
    publisher: { '@type': 'Organization', name: 'pSEO Factory' },
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
  const title = data.title ?? deriveHeadline(data);
  const description = data.description ?? deriveSubheadline(data);
  const keywords = [...new Set(data.pages.flatMap((p) => p.keywords ?? []))].slice(0, 10);
  return {
    title,
    description,
    openGraph: { title, description },
    keywords,
  };
}

export default async function HubPage({ params }: Props) {
  const { slug } = await params;
  const data = getSiteData(slug);
  if (!data || data.pages.length === 0) notFound();

  const { theme } = data;
  const baseDomain = process.env.BASE_DOMAIN ?? 'linoranex.com';
  const siteUrl = `https://${slug}.${baseDomain}`;

  const heroHeadline = deriveHeadline(data);
  const heroSubheadline = deriveSubheadline(data);

  // 전체 키워드 중복 제거 (상위 10개)
  const allKeywords = [...new Set(data.pages.flatMap((p) => p.keywords ?? []))].slice(0, 10);

  // 카테고리 기준 정렬
  const sortedPages = sortPagesByCategory(data.pages);

  return (
    <>
      <ThemeStyle theme={theme} />
      <JsonLdWebSite data={data} siteUrl={siteUrl} />
      <main className="min-h-screen bg-white text-gray-900">

        {/* Hero — 사이트 주제 직접 반영 (개별 글 제목 아님) */}
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
              {heroHeadline}
            </h1>
            <p
              className="hero-sub max-w-2xl mx-auto leading-relaxed"
              style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', opacity: 0.92 }}
            >
              {heroSubheadline}
            </p>
            <p className="mt-4 text-sm" style={{ opacity: 0.7 }}>
              {data.pages.length}개 가이드 · {new Date().getFullYear()}년 최신
            </p>
          </div>
        </section>

        {/* 키워드 태그 */}
        {allKeywords.length > 0 && (
          <section className="py-5 border-b bg-gray-50">
            <div className="max-w-4xl mx-auto px-6 flex flex-wrap gap-2 justify-center">
              {allKeywords.map((kw) => (
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
        )}

        {/* 상황별 가이드 카드 — 카테고리 정렬 */}
        <section className="py-14 px-6">
          <div className="max-w-4xl mx-auto">
            <h2
              className="text-2xl font-bold mb-2 text-center"
              style={{ color: theme.primaryColor }}
            >
              상황별 완벽 가이드
            </h2>
            <p className="text-center text-gray-500 text-sm mb-8">
              아래에서 원하는 상황을 선택하세요
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {sortedPages.map((page) => {
                const category = getCategory(page);
                const catStyle = getCategoryStyle(category, theme.primaryColor);
                return (
                  <a
                    key={page.slug}
                    href={`/${page.slug}`}
                    className="group block p-5 bg-white rounded-xl border-2 transition-all hover:shadow-lg hover:-translate-y-0.5"
                    style={{ borderColor: `${theme.primaryColor}30` }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3
                        className="font-semibold text-gray-800 leading-snug line-clamp-2 flex-1"
                        style={{ fontSize: 'clamp(0.9rem, 2vw, 1rem)' }}
                      >
                        {page.title}
                      </h3>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                        style={{ backgroundColor: catStyle.bg, color: catStyle.text }}
                      >
                        {category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                      {page.description}
                    </p>
                    <p
                      className="mt-3 text-xs font-medium group-hover:underline"
                      style={{ color: theme.primaryColor }}
                    >
                      자세히 보기 →
                    </p>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <footer
          className="py-8 px-6 border-t"
          style={{ borderColor: `${theme.primaryColor}30` }}
        >
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-sm mb-3" style={{ color: theme.primaryColor }}>
              © {new Date().getFullYear()} {heroHeadline}. Powered by pSEO Factory.
            </p>
            <p className="text-center text-xs text-gray-400 mb-3">
              본 콘텐츠는 정보 제공 목적으로만 제공됩니다. {new Date().getFullYear()}년 기준 작성 내용으로 실제 상황과 다를 수 있습니다.
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
