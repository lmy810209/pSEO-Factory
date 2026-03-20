import { NextRequest, NextResponse } from 'next/server';
import { findProjectId, addDomain } from '@/lib/vercel';
import { validateEnv } from '@/lib/env';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: unknown;
      projectId?: unknown;
    };

    const slug = typeof body.slug === 'string' ? body.slug : '';
    if (!slug) {
      return NextResponse.json(
        { error: 'slug가 필요합니다.', step: 'domain' },
        { status: 400 }
      );
    }

    const { BASE_DOMAIN } = validateEnv();
    const domain = `${slug}.${BASE_DOMAIN}`;

    // projectId가 전달된 경우 그대로 사용, 없으면 동적으로 조회
    const projectId =
      typeof body.projectId === 'string' && body.projectId
        ? body.projectId
        : await findProjectId();

    // *.igeol.kr → Vercel 와일드카드 연결이 이미 설정된 것을 가정
    // 해당 서브도메인을 Vercel 프로젝트에 추가
    await addDomain(projectId, domain);

    return NextResponse.json({ domain, url: `https://${domain}` });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: message, step: 'domain' },
      { status: 500 }
    );
  }
}
