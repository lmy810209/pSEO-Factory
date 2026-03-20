import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import type { SiteTheme } from '@/types/pseo';

interface SiteData {
  slug: string;
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

export default async function ContactPage({ params }: Props) {
  const { slug } = await params;
  const data = getSiteData(slug);
  if (!data) notFound();
  const { theme } = data;

  return (
    <main className="min-h-screen bg-white text-gray-900 max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-8" style={{ color: theme.primaryColor }}>
        문의하기
      </h1>
      <div className="space-y-6 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">문의 방법</h2>
          <p>서비스 이용 중 궁금한 점이나 오류 신고가 있으시면 아래 이메일로 연락해 주세요. 확인 후 빠르게 답변 드리겠습니다.</p>
        </section>
        <section className="bg-gray-50 rounded-xl p-6">
          <p className="font-medium text-gray-700">이메일</p>
          <p className="mt-1">contact@linoranex.com</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">유의사항</h2>
          <p>
            본 사이트의 콘텐츠는 <strong>정보 제공 목적</strong>으로만 제공됩니다. 2026년 3월 기준으로 작성된 내용이며, 정확한 정보는 관련 기관에서 직접 확인하시기 바랍니다.
          </p>
        </section>
      </div>
      <footer className="mt-12 pt-6 border-t text-sm text-center" style={{ color: theme.primaryColor, borderColor: `${theme.primaryColor}30` }}>
        <a href="/" className="hover:underline" style={{ color: theme.primaryColor }}>← 홈으로</a>
      </footer>
    </main>
  );
}
