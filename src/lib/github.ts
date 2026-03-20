import { validateEnv } from './env';

type TreeItem = {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string;
};

async function githubFetch(
  path: string,
  options: RequestInit,
  token: string
): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });
  return res;
}

export async function commitFiles(
  files: Record<string, string>,
  message: string
): Promise<string> {
  const { GITHUB_TOKEN, GITHUB_REPO } = validateEnv();
  const [owner, repo] = GITHUB_REPO.split('/');

  // 1. 현재 main 브랜치 ref 가져오기
  const refRes = await githubFetch(
    `/repos/${owner}/${repo}/git/refs/heads/main`,
    { method: 'GET' },
    GITHUB_TOKEN
  );
  if (!refRes.ok) {
    throw new Error(`브랜치 ref 조회 실패: ${refRes.status}`);
  }
  const refData = (await refRes.json()) as { object: { sha: string } };
  const baseSha = refData.object.sha;

  // 2. 현재 커밋의 tree SHA 가져오기
  const commitRes = await githubFetch(
    `/repos/${owner}/${repo}/git/commits/${baseSha}`,
    { method: 'GET' },
    GITHUB_TOKEN
  );
  if (!commitRes.ok) {
    throw new Error(`커밋 조회 실패: ${commitRes.status}`);
  }
  const commitData = (await commitRes.json()) as { tree: { sha: string } };
  const baseTreeSha = commitData.tree.sha;

  // 3. 각 파일에 대한 blob 생성
  const treeItems: TreeItem[] = await Promise.all(
    Object.entries(files).map(async ([filePath, content]) => {
      const blobRes = await githubFetch(
        `/repos/${owner}/${repo}/git/blobs`,
        {
          method: 'POST',
          body: JSON.stringify({ content, encoding: 'utf-8' }),
        },
        GITHUB_TOKEN
      );
      if (!blobRes.ok) {
        throw new Error(`blob 생성 실패 (${filePath}): ${blobRes.status}`);
      }
      const blobData = (await blobRes.json()) as { sha: string };
      return {
        path: filePath,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blobData.sha,
      };
    })
  );

  // 4. 새 tree 생성
  const treeRes = await githubFetch(
    `/repos/${owner}/${repo}/git/trees`,
    {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    },
    GITHUB_TOKEN
  );
  if (!treeRes.ok) {
    throw new Error(`tree 생성 실패: ${treeRes.status}`);
  }
  const treeData = (await treeRes.json()) as { sha: string };

  // 5. 새 커밋 생성
  const newCommitRes = await githubFetch(
    `/repos/${owner}/${repo}/git/commits`,
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: treeData.sha,
        parents: [baseSha],
      }),
    },
    GITHUB_TOKEN
  );
  if (!newCommitRes.ok) {
    throw new Error(`커밋 생성 실패: ${newCommitRes.status}`);
  }
  const newCommitData = (await newCommitRes.json()) as { sha: string };

  // 6. ref 업데이트 (main 브랜치 이동)
  const updateRes = await githubFetch(
    `/repos/${owner}/${repo}/git/refs/heads/main`,
    {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommitData.sha, force: false }),
    },
    GITHUB_TOKEN
  );
  if (!updateRes.ok) {
    throw new Error(`ref 업데이트 실패: ${updateRes.status}`);
  }

  return newCommitData.sha;
}
