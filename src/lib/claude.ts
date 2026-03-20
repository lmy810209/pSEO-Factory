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

다음 구조의 JSON을 생성하세요 (최소 5페이지 이상):
{
  "slug": "영문-케밥케이스-슬러그",
  "theme": {
    "primaryColor": "#HEX색상 (주제 분위기에 맞게)",
    "secondaryColor": "#HEX색상",
    "accentColor": "#HEX색상",
    "gradientDirection": "135deg",
    "mood": "cheerful | natural | calm | energetic 중 하나",
    "fontPair": {
      "heading": "Google Fonts에서 사용 가능한 폰트명 (예: Noto Serif KR, Playfair Display)",
      "body": "Google Fonts에서 사용 가능한 폰트명 (예: Noto Sans KR, Open Sans)"
    }
  },
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

테마 결정 기준 (주제 분석 후 자동 결정):
- 벚꽃/꽃/봄 → primaryColor: #E8A0BF, secondaryColor: #C77DFF, mood: cheerful, 폰트: 우아하게
- 캠핑/자연/등산 → primaryColor: #2D6A4F, secondaryColor: #74C69D, mood: natural, 폰트: 안정적으로
- 어린이/키즈/유아 → primaryColor: #FF6B35, secondaryColor: #FFD166, mood: cheerful, 폰트: 귀엽게
- 바다/낚시/해변 → primaryColor: #0077B6, secondaryColor: #00B4D8, mood: calm, 폰트: 시원하게
- 음식/맛집/레스토랑 → primaryColor: #E63946, secondaryColor: #F4A261, mood: energetic, 폰트: 활기차게
- 건강/의료/웰니스 → primaryColor: #2A9D8F, secondaryColor: #57CC99, mood: calm, 폰트: 신뢰감 있게
- 부동산/인테리어 → primaryColor: #264653, secondaryColor: #E9C46A, mood: calm, 폰트: 고급스럽게
- 기술/IT/디지털 → primaryColor: #3A0CA3, secondaryColor: #4CC9F0, mood: energetic, 폰트: 현대적으로

Google Fonts 한국어 추천: "Noto Serif KR", "Noto Sans KR", "Black Han Sans", "Do Hyeon", "Gowun Dodum"

규칙:
- slug는 영문 소문자와 하이픈만 사용
- 모든 title과 description은 반드시 비어있지 않아야 함
- 5개 이상 페이지 생성 (주제를 세분화하여)
- 한국어로 콘텐츠 작성 (slug, 폰트명 제외)
- fontPair의 폰트명은 Google Fonts API에서 실제 사용 가능한 정확한 이름으로`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
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
