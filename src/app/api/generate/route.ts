import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generatePages } from '@/lib/claude';
import { toSlug } from '@/lib/utils';

export const maxDuration = 60;

function slugExists(slug: string): boolean {
  try {
    const filePath = path.join(process.cwd(), 'public', 'sites', `${slug}.json`);
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      topic?: unknown;
      requirements?: unknown;
    };

    const topic =
      typeof body.topic === 'string' ? body.topic.trim() : '';
    const requirements =
      typeof body.requirements === 'string'
        ? body.requirements.trim()
        : undefined;

    if (!topic) {
      return NextResponse.json(
        { error: '주제(topic)가 필요합니다.', step: 'generate' },
        { status: 400 }
      );
    }

    let result = await generatePages(topic, requirements || undefined);
    let slug = result.slug ? toSlug(result.slug) : toSlug(topic);

    // slug 검증 — 빈 문자열이면 파이프라인 중단
    if (!slug) {
      return NextResponse.json(
        { error: 'slug가 빈 문자열입니다.', step: 'generate' },
        { status: 500 }
      );
    }

    // 추가 8: 슬러그 중복 방지 — 기존 사이트와 다른 각도로 재생성
    if (slugExists(slug)) {
      const dedupeReq = `기존 "${slug}" 슬러그와 다른 각도로 작성. 제목과 슬러그에 다른 [지역/상황/타겟/기준] 조합 사용. 기존과 중복되지 않는 새로운 관점 필수.${requirements ? ' ' + requirements : ''}`;
      result = await generatePages(topic, dedupeReq);
      slug = result.slug ? toSlug(result.slug) : toSlug(topic + '-v2');

      if (!slug) {
        return NextResponse.json(
          { error: 'slug가 빈 문자열입니다.', step: 'generate' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ slug, pages: result.pages, theme: result.theme });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json(
      { error: message, step: 'generate' },
      { status: 500 }
    );
  }
}
