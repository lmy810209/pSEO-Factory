import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { submitToSearchEngines } from '@/lib/searchconsole';

export const maxDuration = 30;

const INDEX_LOG_PATH = path.join(process.cwd(), 'public', 'indexing-log.json');

interface IndexLogEntry {
  slug: string;
  url: string;
  timestamp: number;
  error?: string;
}

interface IndexLog {
  success: IndexLogEntry[];
  failed: IndexLogEntry[];
}

function readIndexLog(): IndexLog {
  try {
    if (fs.existsSync(INDEX_LOG_PATH)) {
      return JSON.parse(fs.readFileSync(INDEX_LOG_PATH, 'utf-8')) as IndexLog;
    }
  } catch { /* ignore */ }
  return { success: [], failed: [] };
}

function writeIndexLog(log: IndexLog): void {
  try {
    fs.writeFileSync(INDEX_LOG_PATH, JSON.stringify(log, null, 2));
  } catch { /* ignore in read-only environments */ }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { slug?: unknown };
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
    if (!slug) {
      return NextResponse.json(
        { error: 'slug가 필요합니다.' },
        { status: 400 }
      );
    }

    const baseDomain = process.env.BASE_DOMAIN ?? 'linoranex.com';
    const siteUrl = `https://${slug}.${baseDomain}`;
    const sitemapUrl = `${siteUrl}/sitemap.xml`;

    const result = await submitToSearchEngines(siteUrl, sitemapUrl);

    const log = readIndexLog();
    const entry: IndexLogEntry = { slug, url: siteUrl, timestamp: Date.now() };
    const isOk = result.google.ok || result.googleIndexing.ok || result.naver.ok;
    const allSkipped = result.google.skipped && result.googleIndexing.skipped && result.naver.skipped;

    if (isOk || allSkipped) {
      log.success = [entry, ...log.success.filter((e) => e.slug !== slug)].slice(0, 100);
      log.failed = log.failed.filter((e) => e.slug !== slug);
    } else {
      const reason = [result.google.reason, result.googleIndexing.reason, result.naver.reason]
        .filter(Boolean)
        .join('; ');
      log.failed = [
        { ...entry, error: reason || '재시도 실패' },
        ...log.failed.filter((e) => e.slug !== slug),
      ].slice(0, 100);
    }
    writeIndexLog(log);

    return NextResponse.json({ slug, siteUrl, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
