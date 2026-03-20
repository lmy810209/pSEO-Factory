import { notFound } from 'next/navigation';
import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import type { PseoPage } from '@/types/pseo';

interface SiteData {
  slug: string;
  pages: PseoPage[];
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
    openGraph: {
      title: page.title,
      description: page.description,
    },
    keywords: page.keywords,
  };
}

export default async function SubdomainPage({ params }: Props) {
  const { slug } = await params;
  const data = getSiteData(slug);

  if (!data || data.pages.length === 0) notFound();

  const indexPage = data.pages[0];

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">{indexPage.title}</h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">{indexPage.content.hero}</p>
        </div>
      </section>

      {/* Keywords */}
      <section className="py-8 bg-gray-50 border-b">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap gap-2 justify-center">
          {indexPage.keywords.map((kw) => (
            <span key={kw} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {kw}
            </span>
          ))}
        </div>
      </section>

      {/* Sections */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          {indexPage.content.sections.map((section, i) => (
            <div key={i}>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{section.heading}</h2>
              <p className="text-gray-600 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Other pages nav */}
      {data.pages.length > 1 && (
        <section className="py-12 bg-gray-50 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">더 알아보기</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.pages.slice(1).map((page) => (
                <a
                  key={page.slug}
                  href={`/${page.slug}`}
                  className="block p-5 bg-white rounded-lg border hover:border-blue-400 hover:shadow-md transition-all"
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
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">자주 묻는 질문</h2>
            <div className="space-y-4">
              {indexPage.content.faq.map((item, i) => (
                <details key={i} className="border rounded-lg">
                  <summary className="px-6 py-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-50">
                    {item.q}
                  </summary>
                  <p className="px-6 pb-4 text-gray-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="py-8 text-center text-sm text-gray-400 border-t">
        <p>© {new Date().getFullYear()} {indexPage.title}. Powered by pSEO Factory.</p>
      </footer>
    </main>
  );
}
