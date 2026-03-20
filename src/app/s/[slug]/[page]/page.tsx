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

  const page = data.pages.find((p) => p.slug === pageSlug);
  if (!page) notFound();

  const { theme } = data;

  return (
    <>
      <ThemeStyle theme={theme} />
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

        <footer
          className="py-6 text-center text-sm border-t"
          style={{ color: theme.primaryColor, borderColor: `${theme.primaryColor}30` }}
        >
          <p>© {new Date().getFullYear()} Powered by pSEO Factory.</p>
        </footer>
      </main>
    </>
  );
}
