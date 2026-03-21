import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { PseoPage, SiteTheme } from '@/types/pseo';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-20250514';

function buildPrompt(topic: string, requirements?: string): string {
  return `주제: ${topic}${requirements ? `\n추가 요구사항: ${requirements}` : ''}

아래 JSON 구조를 생성하세요. 정확히 5개 페이지, 각 섹션 2개:
{
  "slug": "english-kebab-slug",
  "theme": {
    "primaryColor": "#HEX",
    "secondaryColor": "#HEX",
    "accentColor": "#HEX",
    "gradientDirection": "135deg",
    "mood": "cheerful|natural|calm|energetic",
    "fontPair": { "heading": "Noto Serif KR", "body": "Noto Sans KR" }
  },
  "pages": [
    {
      "slug": "page-slug",
      "title": "SEO 제목 (60자 이내)",
      "description": "메타 설명 (160자 이내)",
      "keywords": ["키워드1","키워드2","키워드3"],
      "content": {
        "hero": "히어로 문구 2문장 (150자 이상)",
        "sections": [
          {"heading": "TOP 추천 제목", "body": "400자 이상 상세 큐레이션. 추천 이유·특징·구체적 정보 포함."},
          {"heading": "상황별 가이드 제목", "body": "400자 이상 상세 설명. 팁·주의사항·비교 포함."}
        ],
        "faq": [
          {"q": "자주 묻는 질문1", "a": "100자 이상 상세 답변1"},
          {"q": "자주 묻는 질문2", "a": "100자 이상 상세 답변2"}
        ]
      }
    }
  ]
}

규칙:
- slug: 영문 소문자·하이픈만 (예: seoul-cherry-blossom-top5)
- 페이지 정확히 5개, 각각 다른 검색 의도 (비용/가족/초보/시즌/지역 등)
- sections[].body: 반드시 400자 이상, 풍부한 큐레이션/비교/추천
- 콘텐츠 모두 한국어 (slug·JSON키 제외)
- title·description 필수, 비워두기 금지
- JSON만 출력, 마크다운 없이`;
}

/** JSON 스트림에서 pages 배열의 각 객체를 실시간으로 추출 */
class PageExtractor {
  private buf = '';
  private inStr = false;
  private esc = false;
  private depth = 0;
  private pagesStarted = false;
  private pageStart = -1;
  private slug = '';
  private theme: SiteTheme | null = null;
  private headerEmitted = false;
  private completedPages: PseoPage[] = [];

  feed(text: string): { newPages: PseoPage[]; headerReady: boolean } {
    const newPages: PseoPage[] = [];

    for (const c of text) {
      const pos = this.buf.length;
      this.buf += c;

      if (this.esc) { this.esc = false; continue; }
      if (c === '\\' && this.inStr) { this.esc = true; continue; }
      if (c === '"') { this.inStr = !this.inStr; continue; }
      if (this.inStr) continue;

      if (c === '{') {
        this.depth++;
        if (this.pagesStarted && this.depth === 2 && this.pageStart === -1) {
          this.pageStart = pos;
        }
      } else if (c === '}') {
        if (this.pagesStarted && this.depth === 2 && this.pageStart !== -1) {
          const pageStr = this.buf.slice(this.pageStart);
          try {
            const page = JSON.parse(pageStr) as PseoPage;
            this.completedPages.push(page);
            newPages.push(page);
          } catch { /* incomplete */ }
          this.pageStart = -1;
        }
        this.depth--;
      } else if (c === '[' && !this.pagesStarted) {
        // "pages": [ 패턴 감지 (공백 허용)
        const before = this.buf.slice(0, -1).trimEnd();
        if (before.endsWith('"pages":')) {
          this.pagesStarted = true;
          this.parseHeader();
        }
      }
    }

    const headerReady = !this.headerEmitted && this.slug !== '' && this.theme !== null;
    if (headerReady) this.headerEmitted = true;
    return { newPages, headerReady };
  }

  private parseHeader(): void {
    const pagesIdx = this.buf.lastIndexOf('"pages"');
    if (pagesIdx === -1) return;
    const headerPart = this.buf.slice(0, pagesIdx).trimEnd().replace(/,\s*$/, '') + '}';
    try {
      const h = JSON.parse(headerPart) as { slug?: string; theme?: SiteTheme };
      this.slug = h.slug ?? '';
      this.theme = h.theme ?? null;
    } catch {
      const m = /"slug"\s*:\s*"([^"]+)"/.exec(this.buf);
      if (m) this.slug = m[1];
    }
  }

  getSlug(): string { return this.slug; }
  getTheme(): SiteTheme | null { return this.theme; }
  getPages(): PseoPage[] { return this.completedPages; }
  getRawBuf(): string { return this.buf; }
}

export async function POST(req: NextRequest): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sseError('ANTHROPIC_API_KEY 환경변수 없음');
  }

  let topic = '';
  let requirements: string | undefined;
  try {
    const body = (await req.json()) as { topic?: unknown; requirements?: unknown };
    topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    requirements = typeof body.requirements === 'string' && body.requirements.trim()
      ? body.requirements.trim()
      : undefined;
  } catch {
    return sseError('요청 파싱 실패');
  }

  if (!topic) return sseError('주제(topic)가 필요합니다.');

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (data: object) => {
        try {
          controller.enqueue(encoder.encode('data: ' + JSON.stringify(data) + '\n\n'));
        } catch { /* already closed */ }
      };

      // 15초마다 keepalive ping (프록시 타임아웃 방지)
      const pingTimer = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { /* ignore */ }
      }, 15_000);

      const extractor = new PageExtractor();
      let pageIndex = 0;

      try {
        const anthropicStream = client.messages.stream({
          model: MODEL,
          max_tokens: 6000,
          system: 'JSON만 반환. 마크다운 코드블록 없이 순수 JSON만 출력.',
          messages: [{ role: 'user', content: buildPrompt(topic, requirements) }],
        });

        anthropicStream.on('text', (text: string) => {
          const { newPages, headerReady } = extractor.feed(text);

          if (headerReady) {
            emit({ type: 'slug', slug: extractor.getSlug() });
            const theme = extractor.getTheme();
            if (theme) emit({ type: 'theme', theme });
          }

          for (const page of newPages) {
            emit({ type: 'page', index: pageIndex, title: page.title ?? '', page });
            pageIndex++;
          }
        });

        const finalMsg = await anthropicStream.finalMessage();

        if (finalMsg.stop_reason === 'max_tokens') {
          emit({ type: 'error', message: '토큰 한도 도달 - 재시도해주세요.' });
        } else {
          let pages = extractor.getPages();
          let slug = extractor.getSlug();
          let theme = extractor.getTheme();

          // 폴백: 스트림 파싱 실패 시 전체 버퍼로 재파싱
          if (pages.length === 0) {
            const rawText = finalMsg.content[0]?.type === 'text' ? finalMsg.content[0].text : '';
            try {
              const cleaned = rawText
                .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
              const parsed = JSON.parse(cleaned) as { slug?: string; theme?: SiteTheme; pages?: PseoPage[] };
              pages = parsed.pages ?? [];
              slug = parsed.slug ?? slug;
              theme = parsed.theme ?? theme;
            } catch { /* ignore */ }
          }

          if (pages.length === 0) {
            emit({ type: 'error', message: 'AI 응답 파싱 실패. 재시도해주세요.' });
          } else {
            emit({ type: 'done', slug, theme, pages });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '알 수 없는 오류';
        emit({ type: 'error', message });
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
