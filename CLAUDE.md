# pSEO Factory 프로젝트 가이드라인

주제 하나를 입력하면 SEO 최적화된 Next.js 사이트를 자동 생성·배포하는 웹앱.
Claude API로 데이터 생성 → Next.js Dynamic Routes 페이지 빌드 → Vercel 자동 배포 → igeol.kr 서브도메인 연결까지 원클릭 완결.

## 🛠 빌드 및 실행

- **개발 서버**: `npm run dev` (포트 9002, Turbopack)
- **빌드**: `npm run build` (NODE_ENV=production)
- **타입 체크**: `npx tsc --noEmit`

## 🚀 배포

- **GitHub 리포지토리**: https://github.com/lmy810209/pSEO-Factory
- **호스팅**: Vercel (GitHub 연동 자동 배포)
- **배포 트리거**: `main` 브랜치에 push하면 Vercel이 자동으로 빌드 & 배포
- **수동 배포**: Vercel 대시보드에서 Redeploy 또는 `vercel deploy --prod`

## 🏗 파이프라인 구조

| 단계 | 파일 | 역할 | API |
|------|------|------|-----|
| [1] 데이터 생성 | `app/api/generate/route.ts` | Claude API → JSON | Anthropic |
| [2] 페이지 빌드 | `app/api/build/route.ts` | 템플릿 + 데이터 → Next.js 파일 | 내부 |
| [3] GitHub Push | `lib/github.ts` | 생성 파일 자동 커밋 | GitHub API |
| [4] Vercel 배포 | `app/api/deploy/route.ts` | 프로젝트 생성 + 배포 | Vercel API |
| [5] 도메인 연결 | `app/api/domain/route.ts` | DNS CNAME 자동 등록 | 가비아 API |

- 모든 API route는 `app/api/` 하위 독립 파일로 분리
- 공통 유틸: `lib/` (claude.ts, vercel.ts, github.ts, gabia.ts)
- 타입 정의: `types/pseo.ts`

## 🚨 최우선 원칙

- 파이프라인 5단계 순서는 절대 변경하지 않는다. 단계를 병합하거나 건너뛰지 않는다.
- 실제 배포 경로(Vercel API 호출, DNS 등록, GitHub push)는 사용자의 명시적 요청 없이 수정하지 않는다.
- Claude 모델은 반드시 `claude-sonnet-4-20250514`만 사용한다. 다른 모델로 교체하지 않는다.

## 🧠 핵심 로직 — 절대 변경 금지

아래 로직은 삭제, 완화, 우회, 통합, 단순화, fallback 추가, 조건 축소를 금지한다.

1. **JSON 파싱 안전 처리** — `lib/claude.ts`
   - Claude 응답에서 ` ```json ``` ` 펜스를 제거한 뒤 파싱한다.
   - 파싱 실패 시 파이프라인 즉시 중단. 빈 객체나 null로 fallback 절대 금지.

2. **Slug 정규화** — `lib/utils.ts` `toSlug()`
   - 주제 → `kebab-case` 강제 변환 (한글 포함 모든 특수문자 제거).
   - slug가 빈 문자열이 되면 파이프라인 즉시 중단.

3. **SEO 메타태그 필수 검증** — `lib/builder.ts`
   - 생성된 모든 페이지에 `title`, `description`, `og:title`, `og:description` 4개 모두 존재해야 빌드 진행.
   - 하나라도 빠지면 빌드 단계에서 오류 반환. 빈 문자열도 실패로 처리.

4. **서브도메인 충돌 방지** — `app/api/domain/route.ts`
   - DNS 등록 전 기존 CNAME 레코드 존재 여부 확인.
   - 이미 존재하면 덮어쓰지 않고 오류 반환. 사용자 확인 후 재시도.

5. **Vercel 배포 상태 폴링** — `lib/vercel.ts`
   - 배포 트리거 후 상태를 최대 20회 × 10초 간격으로 폴링.
   - `READY` 확인 전에 DNS 연결 단계로 진행하지 않는다.

6. **환경변수 사전 검증** — `lib/env.ts`
   - 필수 환경변수(`ANTHROPIC_API_KEY`, `VERCEL_TOKEN`, `GITHUB_TOKEN`, `GITHUB_REPO`, `BASE_DOMAIN`) 존재 여부 확인.
   - 하나라도 없으면 파이프라인 즉시 중단.

7. **sitemap.xml 자동 생성** — `lib/builder.ts`
   - 생성된 모든 페이지 slug를 포함한 `sitemap.xml`을 빌드 단계에서 함께 생성.
   - sitemap 누락 시 배포 단계로 진행하지 않는다.

8. **콘텐츠 최소 길이 검증** — `lib/builder.ts`
   - 각 섹션 본문은 최소 300자 이상이어야 한다.
   - 페이지 전체 콘텐츠(hero + sections + faq)는 최소 1500자 이상이어야 한다.
   - 미달 시 빌드 단계에서 `{ error, minRequired, actual }` 포함한 422 오류 반환.

9. **슬러그/타이틀 중복 방지** — `app/api/generate/route.ts`
   - 생성 후 `public/sites/{slug}.json` 존재 여부 확인.
   - 이미 존재하면 Claude에게 다른 [지역/상황/타겟/기준] 조합으로 재생성 요청.
   - 타이틀은 반드시 [지역/상황/타겟/기준] 조합으로 차별화.

10. **콘텐츠 구조 규칙** — `lib/claude.ts` 프롬프트
    - 모든 페이지는 'TOP 5' 또는 '추천 상황별' 비교/큐레이션 구조로 작성.
    - 각 항목마다 '추천 이유' 필수 포함.
    - 페이지마다 검색 의도(intent)가 달라야 함 (비용/가족/초보/시즌/지역 등).

## 🆕 추가 기능

### JSON-LD 구조화 데이터
- 모든 페이지(`app/s/[slug]/page.tsx`, `app/s/[slug]/[page]/page.tsx`)에 Article 스키마 삽입.
- `headline`, `datePublished`, `author`, `description`, `keywords` 포함.

### Google Indexing API
- `GOOGLE_INDEXING_API_KEY` 환경변수 필요. 없으면 skip.
- `indexing.googleapis.com/v3/urlNotifications:publish`에 모든 페이지 URL 전송.
- `lib/searchconsole.ts`의 `submitGoogleIndexing()` 함수 사용.

### 공통 페이지 자동 생성
- 모든 사이트에 `/privacy`, `/contact`, `/about` 경로 자동 제공.
- 푸터에 "정보 제공 목적" 면책조항 및 "2026년 3월 기준" 표기.
- 푸터 링크: 사이트 소개 · 개인정보 처리방침 · 문의하기.

### Google Static Maps
- `GOOGLE_MAPS_API_KEY` 환경변수 필요. 없으면 지도 섹션 미표시.
- 장소/지역 관련 페이지: Claude가 `content.mapQuery`(한국어 검색어) 생성.
- `maps.googleapis.com/maps/api/staticmap` 이미지로 렌더링.

### 내부 링크 (관련 글)
- 모든 서브페이지 하단에 "관련 글" 섹션 표시.
- 현재 페이지 제외 최대 5개 페이지 링크, 키워드 기반 자연스러운 앵커 텍스트.

### 인덱싱 로그
- `public/indexing-log.json`에 성공/실패 기록 (서버 파일시스템 + localStorage 이중 저장).
- `POST /api/retry-index` — 실패 슬러그 재시도 엔드포인트.
- 대시보드에 성공 N / 실패 N 카운트 및 실패 목록 재시도 버튼 표시.

## 📝 코드 스타일

- TypeScript Strict 모드 필수 (`"strict": true`)
- Next.js 14 App Router 전용. `pages/` 디렉토리 방식 혼용 금지
- Tailwind CSS. 인라인 style 속성 최소화
- 변수/함수 `camelCase`, 컴포넌트/타입/인터페이스 `PascalCase`
- 모든 API route는 `try/catch`로 감싸고 `{ error: string, step: string }` 형태로 오류 반환
- `any` 타입 사용 금지. 타입 불명확 시 `unknown` 후 타입가드 처리

## 📂 프로젝트 구조

```
app/
  ├── page.tsx                    # 메인 대시보드 (주제 입력 + 파이프라인 상태)
  ├── preview/[slug]/page.tsx     # 로컬 생성 페이지 프리뷰
  └── api/
      ├── generate/route.ts       # [1] Claude API → JSON 데이터
      ├── build/route.ts          # [2] 템플릿 + 데이터 → 파일 생성
      ├── deploy/route.ts         # [3+4] GitHub push + Vercel 배포
      └── domain/route.ts         # [5] 가비아 DNS 서브도메인 등록
lib/
  ├── claude.ts                   # Claude API 래퍼 (JSON 안전 파싱 포함)
  ├── vercel.ts                   # Vercel API 래퍼 (배포 폴링 포함)
  ├── github.ts                   # GitHub 자동 커밋 유틸
  ├── gabia.ts                    # 가비아 DNS API 래퍼
  ├── env.ts                      # 환경변수 사전 검증
  └── utils.ts                    # slug 정규화 등 공통 유틸
templates/
  └── default/                    # SEO 최적화 기본 페이지 템플릿
types/
  └── pseo.ts                     # 공통 타입 (PseoJob, PseoPage, PipelineStatus)
```

## 🔑 환경변수

```env
ANTHROPIC_API_KEY=              # Claude API 키 (필수)
VERCEL_TOKEN=                   # Vercel API 토큰 (필수)
VERCEL_TEAM_ID=                 # Vercel 팀 ID (개인 계정이면 생략)
VERCEL_PROJECT_ID=              # Vercel 프로젝트 ID (속도 향상용 선택)
GITHUB_TOKEN=                   # GitHub push용 PAT (필수)
GITHUB_REPO=                    # 대상 레포 owner/repo 형식 (필수)
BASE_DOMAIN=linoranex.com       # 서브도메인 베이스 (필수)
NEXT_PUBLIC_BASE_DOMAIN=        # 클라이언트용 도메인 (필수)
GOOGLE_SEARCH_CONSOLE_KEY=      # 구글 서치콘솔 키 (선택, 없으면 skip)
GOOGLE_INDEXING_API_KEY=        # Google Indexing API 키 (선택, 없으면 skip)
GOOGLE_MAPS_API_KEY=            # Google Static Maps 키 (선택, 없으면 지도 미표시)
NAVER_SEARCH_ADVISOR_KEY=       # 네이버 서치어드바이저 키 (선택, 없으면 skip)
WEBHOOK_SECRET=                 # n8n 웹훅 인증 시크릿 (선택)
TELEGRAM_BOT_TOKEN=             # 텔레그램 알림 봇 토큰 (선택)
TELEGRAM_CHAT_ID=               # 텔레그램 채팅 ID (선택)
```

API 키는 절대 코드에 하드코딩하지 않는다. `.env.local`에만 보관.

## 📐 공통 타입

```typescript
// types/pseo.ts

interface PseoJob {
  id: string;
  topic: string;
  slug: string;
  subdomain: string;        // {slug}.igeol.kr
  pages: PseoPage[];
  status: PipelineStatus;
  createdAt: number;
  deployUrl?: string;
  error?: { step: string; message: string };
}

interface PseoPage {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  content: {
    hero: string;
    sections: { heading: string; body: string }[];
    faq: { q: string; a: string }[];
  };
}

type PipelineStatus =
  | 'idle'
  | 'generating'    // [1] Claude 데이터 생성 중
  | 'building'      // [2] 페이지 파일 생성 중
  | 'deploying'     // [3+4] GitHub push + Vercel 배포 중
  | 'connecting'    // [5] DNS 연결 중
  | 'done'
  | 'error';
```

## 🖥 UI 규칙

- 메인 페이지: 주제 입력창 1개 + 실행 버튼 + 파이프라인 5단계 진행 상태 표시
- 각 단계 상태 표시: `대기(회색)` → `진행중(스피너)` → `완료(초록 체크)` → `오류(빨간 X + 메시지)`
- 완료 시 최종 URL (`https://{slug}.igeol.kr`) 클릭 가능 링크로 표시
- 생성 이력 localStorage 저장 (최근 10개). 이력에서 재배포 가능
- 오류 발생 시 어느 단계에서 실패했는지 단계명과 오류 메시지 함께 표시
