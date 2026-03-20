import Anthropic from '@anthropic-ai/sdk';
import { validateEnv } from './env';
import type { PseoPage } from '@/types/pseo';

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

interface GenerateResult {
  slug: string;
  pages: PseoPage[];
}

export async function generatePages(
  topic: string,
  requirements?: string
): Promise<GenerateResult> {
  const { ANTHROPIC_API_KEY } = validateEnv();
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const userPrompt = `주제: ${topic}${requirements ? `\n추가 요구사항: ${requirements}` : ''}

다음 구조의 JSON을 생성하세요 (최소 5페이지 이상):
{
  "slug": "영문-케밥케이스-슬러그",
  "pages": [
    {
      "slug": "page-slug",
      "title": "SEO 최적화 페이지 제목 (60자 이내)",
      "description": "SEO 메타 설명 (160자 이내)",
      "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
      "content": {
        "hero": "히어로 섹션 메인 문구 (2-3문장)",
        "sections": [
          {"heading": "소제목", "body": "본문 3-5문장"},
          {"heading": "소제목2", "body": "본문 3-5문장"},
          {"heading": "소제목3", "body": "본문 3-5문장"}
        ],
        "faq": [
          {"q": "자주 묻는 질문1", "a": "답변1"},
          {"q": "자주 묻는 질문2", "a": "답변2"},
          {"q": "자주 묻는 질문3", "a": "답변3"}
        ]
      }
    }
  ]
}

규칙:
- slug는 영문 소문자와 하이픈만 사용
- 모든 title과 description은 반드시 비어있지 않아야 함
- 5개 이상 페이지 생성 (주제를 세분화하여)
- 한국어로 콘텐츠 작성 (slug 제외)`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8096,
    system: 'JSON만 반환. 마크다운 펜스 없이 순수 JSON만 출력.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text =
    message.content[0].type === 'text' ? message.content[0].text : '';
  const parsed = parseJsonSafe(text);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('slug' in parsed) ||
    !('pages' in parsed)
  ) {
    throw new Error('Claude 응답이 예상 구조와 다릅니다.');
  }

  const result = parsed as { slug: string; pages: unknown[] };

  if (!result.slug || typeof result.slug !== 'string') {
    throw new Error('slug 필드가 없거나 올바르지 않습니다.');
  }

  if (!Array.isArray(result.pages) || result.pages.length === 0) {
    throw new Error('pages 배열이 없거나 비어있습니다.');
  }

  return {
    slug: result.slug,
    pages: result.pages as PseoPage[],
  };
}
