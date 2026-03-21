import { NextRequest, NextResponse } from 'next/server';
import { deleteFiles } from '@/lib/github';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { slug?: unknown };
    const slug = typeof body.slug === 'string' ? body.slug.trim() : '';

    if (!slug) {
      return NextResponse.json({ error: 'slug가 필요합니다.' }, { status: 400 });
    }

    const filePaths = [
      `public/sites/${slug}.json`,
      `public/sitemaps/${slug}.xml`,
      `public/robots/${slug}.txt`,
    ];

    const commitSha = await deleteFiles(filePaths, `pSEO: ${slug} 사이트 삭제 [자동 커밋]`);
    return NextResponse.json({ slug, commitSha });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
