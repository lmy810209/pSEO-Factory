import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const baseDomain = process.env.BASE_DOMAIN ?? 'linoranex.com';

  // public/robots/{slug}.txt 파일이 있으면 반환
  const filePath = path.join(process.cwd(), 'public', 'robots', `${slug}.txt`);
  let content: string;
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
  } else {
    // 파일이 없으면 기본값 생성
    content = [
      'User-agent: *',
      'Allow: /',
      '',
      `Sitemap: https://${slug}.${baseDomain}/sitemap.xml`,
    ].join('\n');
  }

  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
