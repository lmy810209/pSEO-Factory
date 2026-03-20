import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const filePath = path.join(process.cwd(), 'public', 'sitemaps', `${slug}.xml`);
  if (!fs.existsSync(filePath)) {
    return new NextResponse('sitemap not found', { status: 404 });
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return new NextResponse(content, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
