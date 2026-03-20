export interface IndexResult {
  google: { ok: boolean; skipped: boolean; reason?: string };
  naver: { ok: boolean; skipped: boolean; reason?: string };
}

/**
 * Google 사이트맵 ping (인증 불필요)
 * GOOGLE_SEARCH_CONSOLE_KEY가 없으면 skip
 */
async function pingGoogle(sitemapUrl: string): Promise<IndexResult['google']> {
  if (!process.env.GOOGLE_SEARCH_CONSOLE_KEY) {
    return { ok: false, skipped: true, reason: 'GOOGLE_SEARCH_CONSOLE_KEY 없음' };
  }
  try {
    const url = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    const res = await fetch(url, { method: 'GET' });
    return { ok: res.ok, skipped: false };
  } catch (e) {
    return {
      ok: false,
      skipped: false,
      reason: e instanceof Error ? e.message : '요청 실패',
    };
  }
}

/**
 * Naver Search Advisor 사이트맵 제출
 * NAVER_SEARCH_ADVISOR_KEY가 없으면 skip
 */
async function pingNaver(
  siteUrl: string,
  sitemapUrl: string
): Promise<IndexResult['naver']> {
  if (!process.env.NAVER_SEARCH_ADVISOR_KEY) {
    return { ok: false, skipped: true, reason: 'NAVER_SEARCH_ADVISOR_KEY 없음' };
  }
  try {
    const res = await fetch('https://searchadvisor.naver.com/apis/sitemap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${process.env.NAVER_SEARCH_ADVISOR_KEY}`,
      },
      body: new URLSearchParams({
        siteUrl,
        url: sitemapUrl,
      }).toString(),
    });
    return { ok: res.ok, skipped: false };
  } catch (e) {
    return {
      ok: false,
      skipped: false,
      reason: e instanceof Error ? e.message : '요청 실패',
    };
  }
}

export async function submitToSearchEngines(
  siteUrl: string,
  sitemapUrl: string
): Promise<IndexResult> {
  const [google, naver] = await Promise.all([
    pingGoogle(sitemapUrl),
    pingNaver(siteUrl, sitemapUrl),
  ]);
  return { google, naver };
}
