import { NextRequest, NextResponse } from 'next/server';
import { commitFiles } from '@/lib/github';
import { findProjectId, pollDeployment } from '@/lib/vercel';

// GitHub push + Vercel 폴링 대기 (최대 5분)
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: unknown;
      files?: unknown;
    };

    const slug = typeof body.slug === 'string' ? body.slug : '';
    if (!slug) {
      return NextResponse.json(
        { error: 'slug가 필요합니다.', step: 'deploy' },
        { status: 400 }
      );
    }

    if (
      typeof body.files !== 'object' ||
      body.files === null ||
      Array.isArray(body.files)
    ) {
      return NextResponse.json(
        { error: 'files 객체가 필요합니다.', step: 'deploy' },
        { status: 400 }
      );
    }

    const files = body.files as Record<string, string>;

    // [3] GitHub 커밋 & 푸시
    const commitSha = await commitFiles(
      files,
      `pSEO: ${slug} 사이트 생성 [자동 커밋]`
    );

    // [4] Vercel 프로젝트 찾기 + 배포 완료 대기
    const projectId = await findProjectId();
    const deployUrl = await pollDeployment(projectId, commitSha);

    return NextResponse.json({ deployUrl, commitSha, projectId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: message, step: 'deploy' },
      { status: 500 }
    );
  }
}
