import { validateEnv } from './env';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function vercelFetch(
  path: string,
  options: RequestInit,
  token: string,
  teamId?: string
): Promise<Response> {
  const teamQuery = teamId ? `${path.includes('?') ? '&' : '?'}teamId=${teamId}` : '';
  const res = await fetch(`https://api.vercel.com${path}${teamQuery}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });
  return res;
}

export async function findProjectId(): Promise<string> {
  const { VERCEL_TOKEN, VERCEL_TEAM_ID, GITHUB_REPO } = validateEnv();
  const repoName = GITHUB_REPO.split('/')[1];

  const res = await vercelFetch(
    '/v9/projects?limit=100',
    { method: 'GET' },
    VERCEL_TOKEN,
    VERCEL_TEAM_ID
  );

  if (!res.ok) {
    throw new Error(`Vercel 프로젝트 목록 조회 실패: ${res.status}`);
  }

  const data = (await res.json()) as {
    projects: Array<{
      id: string;
      name: string;
      link?: { repo?: string; repoUrl?: string };
    }>;
  };

  const project = data.projects.find(
    (p) =>
      p.name === repoName ||
      p.link?.repo === repoName ||
      p.link?.repoUrl?.includes(GITHUB_REPO)
  );

  if (!project) {
    throw new Error(
      `Vercel 프로젝트를 찾을 수 없습니다. GITHUB_REPO: ${GITHUB_REPO}`
    );
  }

  return project.id;
}

export async function pollDeployment(
  projectId: string,
  afterSha: string
): Promise<string> {
  const { VERCEL_TOKEN, VERCEL_TEAM_ID } = validateEnv();

  // 최대 20회 × 10초 = 200초 폴링
  for (let i = 0; i < 20; i++) {
    await sleep(10_000);

    const res = await vercelFetch(
      `/v6/deployments?projectId=${projectId}&limit=10`,
      { method: 'GET' },
      VERCEL_TOKEN,
      VERCEL_TEAM_ID
    );

    if (!res.ok) continue;

    const data = (await res.json()) as {
      deployments: Array<{
        uid: string;
        url: string;
        state: string;
        meta?: { githubCommitSha?: string };
      }>;
    };

    // 우리가 push한 커밋 SHA로 트리거된 배포 찾기
    const deployment = data.deployments.find(
      (d) => d.meta?.githubCommitSha === afterSha
    );

    if (!deployment) continue;

    if (deployment.state === 'READY') {
      return `https://${deployment.url}`;
    }
    if (deployment.state === 'ERROR' || deployment.state === 'CANCELED') {
      throw new Error(`Vercel 배포 실패 (${deployment.state})`);
    }
  }

  throw new Error('Vercel 배포 타임아웃: 200초 내에 READY 상태 미확인');
}

export async function addDomain(
  projectId: string,
  domain: string
): Promise<void> {
  const { VERCEL_TOKEN, VERCEL_TEAM_ID } = validateEnv();

  const res = await vercelFetch(
    `/v10/projects/${projectId}/domains`,
    {
      method: 'POST',
      body: JSON.stringify({ name: domain }),
    },
    VERCEL_TOKEN,
    VERCEL_TEAM_ID
  );

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    // 이미 존재하는 도메인은 충돌로 처리
    if (res.status === 409) {
      throw new Error(
        `서브도메인 충돌: ${domain} 이미 존재합니다. 수동으로 확인 후 재시도하세요.`
      );
    }
    throw new Error(
      `도메인 추가 실패: ${err.error?.message ?? res.status}`
    );
  }
}
