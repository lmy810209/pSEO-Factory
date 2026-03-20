import { NextRequest, NextResponse } from 'next/server';
import { generatePages } from '@/lib/claude';
import { toSlug } from '@/lib/utils';
import { buildSiteFiles } from '@/lib/builder';
import { commitFiles } from '@/lib/github';
import { findProjectId, pollDeployment, addDomain } from '@/lib/vercel';
import { submitToSearchEngines } from '@/lib/searchconsole';
import { validateEnv } from '@/lib/env';

// GitHub push + Vercel 폴링 + 전체 파이프라인 (최대 10분)
export const maxDuration = 600;

function sendTelegram(message: string): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  // fire-and-forget
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  }).catch(() => {/* 텔레그램 실패는 파이프라인에 영향 없음 */});
}

export async function POST(req: NextRequest) {
  // WEBHOOK_SECRET 검증
  const secret =
    req.headers.get('x-webhook-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '');

  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized', step: 'auth' },
      { status: 401 }
    );
  }

  const body = (await req.json()) as { topic?: unknown; requirements?: unknown };
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  if (!topic) {
    return NextResponse.json(
      { error: 'topic이 필요합니다.', step: 'validate' },
      { status: 400 }
    );
  }

  let step = 'generate';
  try {
    validateEnv();
    const baseDomain = process.env.BASE_DOMAIN ?? 'linoranex.com';

    // [1] AI 콘텐츠 생성
    step = 'generate';
    const genResult = await generatePages(topic);
    const slug = genResult.slug ? toSlug(genResult.slug) : toSlug(topic);
    if (!slug) throw new Error('slug가 빈 문자열입니다.');

    // [2] 빌드 & SEO 검증
    step = 'build';
    const { files, sitemapUrl, siteUrl } = buildSiteFiles(
      slug,
      genResult.pages,
      genResult.theme,
      baseDomain
    );

    // [3] GitHub 커밋
    step = 'github';
    const commitSha = await commitFiles(
      files,
      `pSEO auto: ${slug} [n8n 자동 생성]`
    );

    // [4] Vercel 배포 대기
    step = 'vercel';
    const projectId = await findProjectId();
    const deployUrl = await pollDeployment(projectId, commitSha);

    // [5] 서브도메인 연결
    step = 'domain';
    await addDomain(projectId, `${slug}.${baseDomain}`);

    // [6] 서치콘솔 등록 (키 없으면 skip)
    step = 'index';
    const indexResult = await submitToSearchEngines(siteUrl, sitemapUrl);

    const finalUrl = `https://${slug}.${baseDomain}`;

    // 텔레그램 알림
    sendTelegram(
      `✅ <b>pSEO Factory 자동 생성 완료!</b>\n\n` +
        `📌 주제: ${topic}\n` +
        `🔗 URL: <a href="${finalUrl}">${finalUrl}</a>\n` +
        `📄 페이지: ${genResult.pages.length}개\n` +
        `🎨 테마: ${genResult.theme.mood}\n` +
        `🗺 구글 색인: ${indexResult.google.skipped ? 'skip' : indexResult.google.ok ? '✅' : '❌'}\n` +
        `🔍 네이버 색인: ${indexResult.naver.skipped ? 'skip' : indexResult.naver.ok ? '✅' : '❌'}`
    );

    return NextResponse.json({
      ok: true,
      slug,
      finalUrl,
      deployUrl,
      pages: genResult.pages.length,
      theme: genResult.theme.mood,
      index: indexResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';

    sendTelegram(
      `❌ <b>pSEO Factory 생성 실패</b>\n\n` +
        `📌 주제: ${topic}\n` +
        `⚠️ 단계: ${step}\n` +
        `💬 오류: ${message}`
    );

    return NextResponse.json(
      { error: message, step },
      { status: 500 }
    );
  }
}
