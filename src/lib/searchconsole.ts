export interface IndexResult {
  google: { ok: boolean; skipped: boolean; reason?: string };
  googleIndexing: { ok: boolean; skipped: boolean; submittedUrls?: number; reason?: string };
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
 * Google Indexing API — 각 페이지 URL을 직접 색인 요청
 * GOOGLE_INDEXING_API_KEY가 없으면 skip
 */
async function submitGoogleIndexing(
  siteUrl: string,
  pageUrls: string[]
): Promise<IndexResult['googleIndexing']> {
  const apiKey = process.env.GOOGLE_INDEXING_API_KEY;
  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'GOOGLE_INDEXING_API_KEY 없음' };
  }
  try {
    const endpoint = `https://indexing.googleapis.com/v3/urlNotifications:publish?key=${apiKey}`;
    const urls = [siteUrl, ...pageUrls].slice(0, 20); // 최대 20개
    let successCount = 0;
    const errors: string[] = [];

    await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, type: 'URL_UPDATED' }),
          });
          if (res.ok) {
            successCount++;
          } else {
            const body = await res.text();
            errors.push(`${url}: ${res.status} ${body.slice(0, 100)}`);
          }
        } catch (e) {
          errors.push(`${url}: ${e instanceof Error ? e.message : '요청 실패'}`);
        }
      })
    );

    return {
      ok: successCount > 0,
      skipped: false,
      submittedUrls: successCount,
      reason: errors.length > 0 ? errors.slice(0, 3).join('; ') : undefined,
    };
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
  sitemapUrl: string,
  pageUrls: string[] = []
): Promise<IndexResult> {
  const [google, googleIndexing, naver] = await Promise.all([
    pingGoogle(sitemapUrl),
    submitGoogleIndexing(siteUrl, pageUrls),
    pingNaver(siteUrl, sitemapUrl),
  ]);
  return { google, googleIndexing, naver };
}
