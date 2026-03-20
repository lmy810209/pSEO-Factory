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
    openGraph: {
      title: page.title,
      description: page.description,
    },
    keywords: page.keywords,
  };
}

export default async function SubdomainSubPage({ params }: Props) {
  const { slug, page: pageSlug } = await params;
  const data = getSiteData(slug);
  if (!data) notFound();

  const page = data.pages.find((p) => p.slug === pageSlug);
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Breadcrumb */}
      <nav className="bg-gray-50 border-b px-6 py-3">
        <div className="max-w-4xl mx-auto text-sm text-gray-500">
          <a href="/" className="hover:text-blue-600">홈</a>
          <span className="mx-2">/</span>
          <span className="text-gray-800">{page.title}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{page.title}</h1>
          <p className="text-blue-100 text-lg">{page.content.hero}</p>
        </div>
      </section>

      {/* Keywords */}
      <section className="py-6 bg-gray-50 border-b">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap gap-2">
          {page.keywords.map((kw) => (
            <span key={kw} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {kw}
            </span>
          ))}
        </div>
      </section>

      {/* Sections */}
      <section className="py-14 px-6">
        <div className="max-w-4xl mx-auto space-y-10">
          {page.content.sections.map((section, i) => (
            <div key={i}>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">{section.heading}</h2>
              <p className="text-gray-600 leading-relaxed">{section.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      {page.content.faq.length > 0 && (
        <section className="py-12 px-6 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">자주 묻는 질문</h2>
            <div className="space-y-3">
              {page.content.faq.map((item, i) => (
                <details key={i} className="border rounded-lg bg-white">
                  <summary className="px-5 py-4 cursor-pointer font-medium text-gray-800 hover:bg-gray-50">
                    {item.q}
                  </summary>
                  <p className="px-5 pb-4 text-gray-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="py-6 text-center text-sm text-gray-400 border-t">
        <p>© {new Date().getFullYear()} Powered by pSEO Factory.</p>
      </footer>
    </main>
  );
}
