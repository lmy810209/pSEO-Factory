import { NextRequest, NextResponse } from 'next/server';
import { findProjectId } from '@/lib/vercel';
import { validateEnv } from '@/lib/env';

export const maxDuration = 15;

async function vercelFetch(
  path: string,
  token: string,
  teamId?: string
): Promise<Response> {
  const teamQuery = teamId ? `${path.includes('?') ? '&' : '?'}teamId=${teamId}` : '';
  try {
    return await fetch(`https://api.vercel.com${path}${teamQuery}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new Error('GitHub API 응답 없음 (30초 초과) - 네트워크 문제일 수 있습니다. 재시도해주세요.');
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      commitSha?: unknown;
      projectId?: unknown;
    };

    const commitSha = typeof body.commitSha === 'string' ? body.commitSha : '';
    const projectIdParam = typeof body.projectId === 'string' ? body.projectId : '';

    if (!commitSha) {
      return NextResponse.json({ error: 'commitSha가 필요합니다.' }, { status: 400 });
    }

    const { VERCEL_TOKEN, VERCEL_TEAM_ID } = validateEnv();
    const projectId = projectIdParam || (await findProjectId());

    const res = await vercelFetch(
      `/v6/deployments?projectId=${projectId}&limit=10`,
      VERCEL_TOKEN,
      VERCEL_TEAM_ID
    );

    if (!res.ok) {
      return NextResponse.json({ state: 'PENDING' });
    }

    const data = (await res.json()) as {
      deployments: Array<{
        uid: string;
        url: string;
        state: string;
        meta?: { githubCommitSha?: string };
      }>;
    };

    const deployment = data.deployments.find(
      (d) => d.meta?.githubCommitSha === commitSha
    );

    if (!deployment) {
      return NextResponse.json({ state: 'PENDING' });
    }

    return NextResponse.json({
      state: deployment.state,
      deployUrl: deployment.state === 'READY' ? `https://${deployment.url}` : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
