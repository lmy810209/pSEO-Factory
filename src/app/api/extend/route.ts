import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import type { PseoPage, SiteTheme, SiteData } from '@/types/pseo';
import type { SiteMeta } from '@/lib/builder';
import { buildSiteFiles } from '@/lib/builder';
import { commitFiles } from '@/lib/github';
import { validateEnv } from '@/lib/env';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-20250514';

const EXTEND_INTENTS = [
  '혼자 즐기기 / 솔로 여행 (자유 여행·혼행)',
  '주말·당일치기 코스 (반나절·하루 일정)',
  '계절별 최적 방문 시기 (봄·여름·가을·겨울)',
  '가성비 / 저예산 완전 정복 (알뜰 여행)',
  '숨은 명소 / 현지인 추천 (잘 모르는 곳)',
  '맛집·카페 연계 코스 (먹거리·쉬어가기)',
  '야경·야간 감상 명소 (저녁·밤 여행)',
  '시니어·어르신 동반 여행 (노약자 친화)',
];

/** 현재 연도보다 이전 연도 포함 여부 검사 */
function containsPastYear(text: string, currentYear: number): boolean {
  const found = text.match(/\b(20\d{2})\b/g);
  return found ? found.some((y) => parseInt(y) < currentYear) : false;
}

function buildPagePrompt(
  topic: string,
  siteSlug: string,
  intent: string,
  year: number,
  existingSlugs: string[]
): string {
  return `주제: ${topic}
현재 연도: ${year}
검색 의도: ${intent}
기존 페이지 슬러그 (중복 금지): ${existingSlugs.join(', ')}

아래 JSON을 생성하세요. 페이지 1개:
{
  "slug": "page-slug",
  "title": "SEO 제목 (60자 이내, ${year}년 정보 포함)",
  "description": "메타 설명 (160자 이내)",
  "keywords": ["키워드1","키워드2","키워드3"],
  "content": {
    "hero": "히어로 문구 2문장 (150자 이상)",
    "sections": [
      {"heading": "소제목1", "body": "400자 이상 상세 큐레이션. 추천 이유·특징·구체적 정보 포함."},
      {"heading": "소제목2", "body": "400자 이상 상세 설명. 팁·주의사항·비교 포함."}
    ],
    "faq": [
      {"q": "자주 묻는 질문1", "a": "100자 이상 상세 답변1"},
      {"q": "자주 묻는 질문2", "a": "100자 이상 상세 답변2"}
    ]
  }
}

규칙:
- slug: 영문 소문자·하이픈만, 기존 슬러그와 반드시 달라야 함
- ${year}년 최신 정보 기준 (과거 연도 절대 사용 금지)
- 검색 의도 "${intent}"에 맞게 작성
- sections[].body: 400자 이상 풍부하게
- 콘텐츠 모두 한국어 (slug·JSON키 제외)
- JSON만 출력, 마크다운 없이`;
}

async function callClaude(client: Anthropic, prompt: string): Promise<string> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: 'JSON만 반환. 마크다운 코드블록 없이 순수 JSON만 출력.',
    messages: [{ role: 'user', content: prompt }],
  });
  if (msg.stop_reason === 'max_tokens') throw new Error('토큰 한도 도달');
  return msg.content[0]?.type === 'text' ? msg.content[0].text : '';
}

function parseJson<T>(text: string): T | null {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned) as T;
  } catch { return null; }
}

export async function POST(req: NextRequest): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return sseError('ANTHROPIC_API_KEY 환경변수 없음');

  let slug = '';
  try {
    const body = (await req.json()) as { slug?: unknown };
    slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  } catch {
    return sseError('요청 파싱 실패');
  }
  if (!slug) return sseError('slug가 필요합니다.');

  // 기존 사이트 데이터 읽기
  const siteFilePath = path.join(process.cwd(), 'public', 'sites', `${slug}.json`);
  if (!fs.existsSync(siteFilePath)) {
    return sseError(`사이트 데이터를 찾을 수 없습니다: ${slug}`);
  }

  let siteData: SiteData;
  try {
    siteData = JSON.parse(fs.readFileSync(siteFilePath, 'utf-8')) as SiteData;
  } catch {
    return sseError('사이트 데이터 파싱 실패');
  }

  // 환경변수 검증 (GitHub 커밋에 필요)
  try { validateEnv(); } catch (e) {
    return sseError(e instanceof Error ? e.message : '환경변수 검증 실패');
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const year = new Date().getFullYear();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (data: object) => {
        try { controller.enqueue(encoder.encode('data: ' + JSON.stringify(data) + '\n\n')); }
        catch { /* already closed */ }
      };

      const pingTimer = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { /* ignore */ }
      }, 15_000);

      try {
        const existingPages = siteData.pages;
        const existingSlugs = existingPages.map((p) => p.slug);
        const topic = existingPages[0]?.title?.split(' ')[0] ?? slug;

        // 기존 페이지 수를 기준으로 EXTEND_INTENTS에서 3개 선택
        const startIdx = existingPages.length % EXTEND_INTENTS.length;
        const intents = [0, 1, 2].map((i) => EXTEND_INTENTS[(startIdx + i) % EXTEND_INTENTS.length]);

        const { baseDomain } = (() => {
          const bd = process.env.BASE_DOMAIN ?? 'linoranex.com';
          return { baseDomain: bd };
        })();

        const newPages: PseoPage[] = [];

        // 3개 페이지 순차 생성 (병렬 금지)
        for (let i = 0; i < intents.length; i++) {
          const intent = intents[i];
          const intentLabel = intent.split('(')[0].trim();
          emit({ type: 'status', message: `추가 페이지 ${i + 1}/3 생성 중... (${intentLabel})` });

          try {
            const allSlugs = [...existingSlugs, ...newPages.map((p) => p.slug)];
            let page: PseoPage | null = null;
            for (let attempt = 0; attempt < 2; attempt++) {
              const text = await callClaude(
                client,
                buildPagePrompt(topic, slug, intent, year, allSlugs)
              );
              const parsed = parseJson<PseoPage>(text);
              if (!parsed) continue;
              if (containsPastYear(JSON.stringify(parsed), year)) continue;
              page = parsed;
              break;
            }
            if (page && page.slug && page.title) {
              newPages.push(page);
              emit({ type: 'page', index: i, title: page.title, page });
            }
          } catch {
            // 해당 페이지만 skip
          }
        }

        if (newPages.length === 0) {
          emit({ type: 'error', message: '추가 페이지 생성에 모두 실패했습니다. 재시도해주세요.' });
          return;
        }

        // 업데이트된 페이지 목록으로 사이트 파일 재생성
        emit({ type: 'status', message: 'GitHub에 커밋 중...' });
        const allPages = [...existingPages, ...newPages];
        const existingMeta: SiteMeta = {
          topic: (siteData as SiteData).topic,
          title: (siteData as SiteData).title,
          description: (siteData as SiteData).description,
          heroHeadline: (siteData as SiteData).heroHeadline,
          heroSubheadline: (siteData as SiteData).heroSubheadline,
        };
        const { files } = buildSiteFiles(slug, allPages, siteData.theme, baseDomain, existingMeta);

        await commitFiles(files, `pSEO: ${slug} 추가 페이지 ${newPages.length}개 [자동 커밋]`);

        emit({
          type: 'done',
          addedCount: newPages.length,
          totalPages: allPages.length,
          newPages,
        });
      } catch (err) {
        emit({ type: 'error', message: err instanceof Error ? err.message : '알 수 없는 오류' });
      } finally {
        clearInterval(pingTimer);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}

function sseError(message: string): Response {
  return new Response('data: ' + JSON.stringify({ type: 'error', message }) + '\n\n', {
    status: 400,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
