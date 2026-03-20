import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import type { PseoPage, SiteTheme } from '@/types/pseo';

interface SiteData {
  slug: string;
  pages: PseoPage[];
  theme: SiteTheme;
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

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AboutPage({ params }: Props) {
  const { slug } = await params;
  const data = getSiteData(slug);
  if (!data) notFound();
  const { theme, pages } = data;
  const mainTitle = pages[0]?.title ?? slug;

  return (
    <main className="min-h-screen bg-white text-gray-900 max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-8" style={{ color: theme.primaryColor }}>
        사이트 소개
      </h1>
      <div className="space-y-6 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">이 사이트에 대해</h2>
          <p>
            {mainTitle} 관련 정보를 제공하는 전문 정보 사이트입니다. 최신 정보를 바탕으로 유익하고 신뢰할 수 있는 콘텐츠를 제공하기 위해 노력합니다.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">제공 정보</h2>
          <ul className="list-disc list-inside space-y-1">
            {pages.map((page) => (
              <li key={page.slug}>
                <a href={`/${page.slug}`} className="hover:underline" style={{ color: theme.primaryColor }}>
                  {page.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">면책조항</h2>
          <p>
            본 사이트의 모든 콘텐츠는 <strong>정보 제공 목적</strong>으로만 제공됩니다. 2026년 3월 기준으로 작성된 내용이며, 시간이 지남에 따라 변경될 수 있습니다. 중요한 결정을 내리기 전에 반드시 해당 기관이나 전문가에게 직접 확인하시기 바랍니다.
          </p>
        </section>
      </div>
      <footer className="mt-12 pt-6 border-t text-sm text-center" style={{ color: theme.primaryColor, borderColor: `${theme.primaryColor}30` }}>
        <a href="/" className="hover:underline" style={{ color: theme.primaryColor }}>← 홈으로</a>
      </footer>
    </main>
  );
}
