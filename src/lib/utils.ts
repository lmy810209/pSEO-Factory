import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import crypto from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, '') // 비ASCII(한글 등) 제거
    .replace(/[^a-z0-9\s-]/g, '') // 알파벳·숫자·공백·하이픈만 유지
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    // 전부 한글 등 비ASCII인 경우 → 해시 기반 슬러그
    return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
  }

  return slug;
}
