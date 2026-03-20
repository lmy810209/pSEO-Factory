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

export default async function PrivacyPage({ params }: Props) {
  const { slug } = await params;
  const data = getSiteData(slug);
  if (!data) notFound();
  const { theme } = data;

  return (
    <main className="min-h-screen bg-white text-gray-900 max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-8" style={{ color: theme.primaryColor }}>
        개인정보 처리방침
      </h1>
      <div className="space-y-6 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">1. 개인정보의 수집 및 이용 목적</h2>
          <p>본 사이트는 서비스 제공을 위해 최소한의 개인정보만을 수집합니다. 수집된 개인정보는 서비스 운영 이외의 목적으로 사용되지 않습니다.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">2. 개인정보의 보유 및 이용 기간</h2>
          <p>개인정보는 수집 목적이 달성된 후 지체 없이 파기합니다.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">3. 개인정보의 제3자 제공</h2>
          <p>수집한 개인정보는 제3자에게 제공하지 않습니다.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">4. 쿠키(Cookie) 사용</h2>
          <p>본 사이트는 서비스 개선을 위해 쿠키를 사용할 수 있습니다. 브라우저 설정을 통해 쿠키 사용을 거부할 수 있습니다.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">5. 면책조항</h2>
          <p>본 사이트의 콘텐츠는 <strong>정보 제공 목적</strong>으로만 제공됩니다. 2026년 3월 기준으로 작성된 내용이며, 실제 상황과 다를 수 있습니다. 중요한 결정을 내리기 전에 반드시 전문가 또는 공식 기관에 확인하시기 바랍니다.</p>
        </section>
      </div>
      <footer className="mt-12 pt-6 border-t text-sm text-center" style={{ color: theme.primaryColor, borderColor: `${theme.primaryColor}30` }}>
        <a href="/" className="hover:underline" style={{ color: theme.primaryColor }}>← 홈으로</a>
      </footer>
    </main>
  );
}
