import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { PseoPage, SiteTheme } from '@/types/pseo';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-20250514';

// 5개 페이지의 검색 의도 — 각 페이지 개별 생성에 사용
const PAGE_INTENTS = [
  'TOP5 핵심 명소 총정리 (가장 유명하고 반드시 가야 할 곳)',
  '가족·어린이와 함께 즐기기 (아이 동반 가족 여행)',
  '데이트·로맨틱 코스 (연인과 함께)',
  '사진·인증샷 명소 (포토존 · SNS 감성)',
  '교통·주차·접근성 실전 가이드 (대중교통·주차 정보)',
];

interface SiteHeader {
  slug: string;
  title: string;
  description: string;
  heroHeadline: string;
  heroSubheadline: string;
  theme: SiteTheme;
}

/** 현재 연도보다 이전 연도 포함 여부 검사 */
function containsPastYear(text: string, currentYear: number): boolean {
  const found = text.match(/\b(20\d{2})\b/g);
  return found ? found.some((y) => parseInt(y) < currentYear) : false;
}

function buildHeaderPrompt(topic: string, year: number): string {
  return `주제: ${topic}
현재 연도: ${year}

아래 JSON을 생성하세요. 사이트 메타데이터와 테마:
{
  "slug": "english-kebab-slug",
  "title": "사이트 SEO 제목 (60자 이내, ${year}년 포함)",
  "description": "사이트 메타 설명 (160자 이내, 주제 전체 요약)",
  "heroHeadline": "홈페이지 메인 H1 (주제 그대로 또는 발전형, 30자 이내)",
  "heroSubheadline": "홈페이지 부제목 (사이트 전체 소개 2문장, 100자 이상)",
  "theme": {
    "primaryColor": "#HEX",
    "secondaryColor": "#HEX",
    "accentColor": "#HEX",
    "gradientDirection": "135deg",
    "mood": "cheerful|natural|calm|energetic",
    "fontPair": { "heading": "Noto Serif KR", "body": "Noto Sans KR" }
  }
}

규칙:
- slug: 영문 소문자·하이픈만 (예: seoul-cherry-blossom-top5)
- title, heroHeadline, heroSubheadline: ${year}년 기준, ${year - 1}년 이하 과거 연도 절대 사용 금지
- heroHeadline: 특정 글이 아닌 사이트 전체 주제를 대표하는 제목
- heroSubheadline: 개별 글 내용 아님. 사이트 전체를 한눈에 소개
- 테마: 주제 분위기에 맞는 색상
- JSON만 출력, 마크다운 없이`;
}

function buildPagePrompt(
  topic: string,
  siteSlug: string,
  intent: string,
  year: number
): string {
  return `주제: ${topic}
현재 연도: ${year}
검색 의도: ${intent}

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
- slug: 영문 소문자·하이픈만, 사이트 slug "${siteSlug}"와 달라야 함
- ${year}년 최신 정보 기준. ${year - 1}년 이하 과거 연도 절대 사용 금지
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

/** 페이지 생성 — 과거 연도 감지 시 1회 재시도 */
async function generatePage(
  client: Anthropic,
  topic: string,
  siteSlug: string,
  intent: string,
  year: number
): Promise<PseoPage | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callClaude(client, buildPagePrompt(topic, siteSlug, intent, year));
    const page = parseJson<PseoPage>(text);
    if (!page) continue;
    if (containsPastYear(JSON.stringify(page), year)) continue; // retry
    return page;
  }
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return sseError('ANTHROPIC_API_KEY 환경변수 없음');

  let topic = '';
  try {
    const body = (await req.json()) as { topic?: unknown };
    topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  } catch {
    return sseError('요청 파싱 실패');
  }
  if (!topic) return sseError('주제(topic)가 필요합니다.');

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
        // [1] 사이트 메타데이터 + 테마 생성
        emit({ type: 'status', message: '테마 및 사이트 구조 분석 중...' });
        const headerText = await callClaude(client, buildHeaderPrompt(topic, year));
        const header = parseJson<SiteHeader>(headerText);

        if (!header?.slug || !header?.theme || !header?.heroHeadline) {
          emit({ type: 'error', message: '사이트 메타데이터 생성 실패. 재시도해주세요.' });
          return;
        }

        // 헤더 과거 연도 검증
        if (containsPastYear(JSON.stringify(header), year)) {
          emit({ type: 'error', message: `생성된 메타데이터에 과거 연도가 포함되었습니다. 재시도해주세요.` });
          return;
        }

        emit({
          type: 'header',
          slug: header.slug,
          title: header.title,
          description: header.description,
          heroHeadline: header.heroHeadline,
          heroSubheadline: header.heroSubheadline,
          theme: header.theme,
        });

        // [2] 5개 페이지 병렬 생성 — 각 max_tokens: 4096, 실패/과거연도 시 skip
        const allPages: (PseoPage | null)[] = new Array(PAGE_INTENTS.length).fill(null) as null[];

        await Promise.all(
          PAGE_INTENTS.map(async (intent, i) => {
            try {
              const intentLabel = intent.split('(')[0].trim();
              emit({ type: 'status', message: `페이지 ${i + 1}/5 생성 중... (${intentLabel})` });
              const page = await generatePage(client, topic, header.slug, intent, year);
              if (page) {
                allPages[i] = page;
                emit({ type: 'page', index: i, title: page.title ?? '', page });
              }
            } catch { /* 해당 페이지만 skip */ }
          })
        );

        const pages = allPages.filter((p): p is PseoPage => p !== null);
        if (pages.length === 0) {
          emit({ type: 'error', message: '모든 페이지 생성 실패. 재시도해주세요.' });
        } else {
          emit({
            type: 'done',
            slug: header.slug,
            title: header.title,
            description: header.description,
            heroHeadline: header.heroHeadline,
            heroSubheadline: header.heroSubheadline,
            theme: header.theme,
            pages,
          });
        }
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
