import Anthropic from '@anthropic-ai/sdk';
import { validateEnv } from './env';
import type { PseoPage, SiteTheme } from '@/types/pseo';

const MODEL = 'claude-sonnet-4-20250514';

function parseJsonSafe(text: string): unknown {
  // 마크다운 펜스 제거
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`JSON 파싱 실패. Claude 응답:\n${text.slice(0, 500)}`);
  }
  return parsed;
}

export interface GenerateResult {
  slug: string;
  pages: PseoPage[];
  theme: SiteTheme;
}

export async function generatePages(
  topic: string,
  requirements?: string
): Promise<GenerateResult> {
  const { ANTHROPIC_API_KEY } = validateEnv();
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const userPrompt = `주제: ${topic}${requirements ? `\n추가 요구사항: ${requirements}` : ''}

아래 JSON 구조를 생성하세요. 정확히 3개 페이지, 각 섹션은 2개:
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
        "hero": "히어로 문구 (2문장)",
        "sections": [
          {"heading": "소제목1", "body": "본문 2-3문장"},
          {"heading": "소제목2", "body": "본문 2-3문장"}
        ],
        "faq": [
          {"q": "질문1", "a": "답변1"},
          {"q": "질문2", "a": "답변2"}
        ]
      }
    }
  ]
}

규칙:
- slug: 영문 소문자·하이픈만
- 페이지 정확히 3개
- 한국어로 콘텐츠 작성 (slug 제외)
- title, description 비어있으면 안 됨
- 테마: 주제 분위기에 맞는 색상 선택`;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    system: 'JSON만 반환. 마크다운 펜스 없이 순수 JSON만 출력.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === 'max_tokens') {
    throw new Error('Claude 응답이 토큰 한도에 도달해 JSON이 잘렸습니다. 재시도해주세요.');
  }

  const text =
    message.content[0].type === 'text' ? message.content[0].text : '';
  const parsed = parseJsonSafe(text);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('slug' in parsed) ||
    !('pages' in parsed) ||
    !('theme' in parsed)
  ) {
    throw new Error('Claude 응답이 예상 구조와 다릅니다 (slug/pages/theme 필드 필요).');
  }

  const result = parsed as { slug: string; pages: unknown[]; theme: unknown };

  if (!result.slug || typeof result.slug !== 'string') {
    throw new Error('slug 필드가 없거나 올바르지 않습니다.');
  }
  if (!Array.isArray(result.pages) || result.pages.length === 0) {
    throw new Error('pages 배열이 없거나 비어있습니다.');
  }
  if (typeof result.theme !== 'object' || result.theme === null) {
    throw new Error('theme 객체가 없습니다.');
  }

  return {
    slug: result.slug,
    pages: result.pages as PseoPage[],
    theme: result.theme as SiteTheme,
  };
}
