'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, Circle, ExternalLink, History, Trash2 } from 'lucide-react';
import type { PseoPage, SiteTheme } from '@/types/pseo';

type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
  error?: string;
}

interface HistoryItem {
  topic: string;
  slug: string;
  url: string;
  createdAt: number;
}

interface IndexLogEntry {
  slug: string;
  url: string;
  timestamp: number;
  error?: string;
}

interface IndexLog {
  success: IndexLogEntry[];
  failed: IndexLogEntry[];
}

interface SiteInfo {
  slug: string;
  pages: Array<{ slug: string; title: string; description: string }>;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    gradientDirection: string;
    mood: string;
  };
  generatedAt: number;
}

const INITIAL_STEPS: Step[] = [
  { id: 'generate', label: 'AI 콘텐츠 & 테마 생성',    status: 'pending' },
  { id: 'build',    label: '페이지 빌드 & SEO 검증',    status: 'pending' },
  { id: 'github',   label: 'GitHub 커밋',               status: 'pending' },
  { id: 'vercel',   label: 'Vercel 배포 대기',           status: 'pending' },
  { id: 'domain',   label: '서브도메인 연결',             status: 'pending' },
  { id: 'index',    label: '서치콘솔 등록',              status: 'pending' },
];

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'linoranex.com';
const HISTORY_KEY = 'pseo_history';
const INDEX_LOG_KEY = 'pseo_index_log';

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'running')  return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
  if (status === 'done')     return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (status === 'error')    return <XCircle className="w-5 h-5 text-red-500" />;
  if (status === 'skipped')  return <Circle className="w-5 h-5 text-slate-600" />;
  return <Circle className="w-5 h-5 text-slate-700" />;
}

export default function Home() {
  const [topic, setTopic] = useState('');
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [finalUrl, setFinalUrl] = useState('');
  const [themeInfo, setThemeInfo] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [indexLog, setIndexLog] = useState<IndexLog>({ success: [], failed: [] });
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved) as HistoryItem[]);
    } catch { /* ignore */ }
    try {
      const log = localStorage.getItem(INDEX_LOG_KEY);
      if (log) setIndexLog(JSON.parse(log) as IndexLog);
    } catch { /* ignore */ }
    void fetchSites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 현재 실행 중인 step을 ref로 추적 (클로저 버그 방지)
  const currentStepRef = useRef<string | null>(null);

  const setStep = useCallback((id: string, status: StepStatus, detail?: string, error?: string) => {
    if (status === 'running') {
      currentStepRef.current = id;
    } else if (currentStepRef.current === id) {
      currentStepRef.current = null;
    }
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, detail, error } : s))
    );
  }, []);

  function resetSteps() {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus, detail: undefined, error: undefined })));
    setFinalUrl('');
    setThemeInfo('');
  }

  function saveHistory(item: HistoryItem) {
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.slug !== item.slug)].slice(0, 10);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }

  function updateIndexLog(entry: IndexLogEntry, ok: boolean) {
    setIndexLog((prev) => {
      const next: IndexLog = ok
        ? {
            success: [entry, ...prev.success.filter((e) => e.slug !== entry.slug)].slice(0, 100),
            failed: prev.failed.filter((e) => e.slug !== entry.slug),
          }
        : {
            success: prev.success.filter((e) => e.slug !== entry.slug),
            failed: [entry, ...prev.failed.filter((e) => e.slug !== entry.slug)].slice(0, 100),
          };
      localStorage.setItem(INDEX_LOG_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function fetchSites() {
    setSitesLoading(true);
    try {
      const res = await fetch('/api/sites');
      if (!res.ok) return;
      const data = (await res.json()) as { sites: SiteInfo[] };
      setSites(data.sites ?? []);
    } catch { /* ignore */ } finally {
      setSitesLoading(false);
    }
  }

  async function deleteSite(slug: string) {
    setDeletingSlug(slug);
    try {
      const res = await fetch('/api/sites/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? '삭제 실패');
      }
      // 로컬 상태 즉시 제거
      setSites((prev) => prev.filter((s) => s.slug !== slug));
      setHistory((prev) => {
        const next = prev.filter((h) => h.slug !== slug);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류 발생');
    } finally {
      setDeletingSlug(null);
      setConfirmDelete(null);
    }
  }

  async function retryIndex(slug: string) {
    try {
      await apiPost('/api/retry-index', { slug });
      const entry: IndexLogEntry = { slug, url: `https://${slug}.${BASE_DOMAIN}`, timestamp: Date.now() };
      updateIndexLog(entry, true);
    } catch {
      /* ignore retry errors */
    }
  }

  async function apiPost<T>(url: string, body: unknown, timeoutMs = 58_000): Promise<T> {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        throw new Error('요청 시간 초과 (서버 응답 없음). 재시도해주세요.');
      }
      throw e;
    }
    let data: T & { error?: string; step?: string };
    try {
      data = (await res.json()) as T & { error?: string; step?: string };
    } catch {
      throw new Error(`서버 오류 (${res.status}). 재시도해주세요.`);
    }
    if (!res.ok) {
      throw Object.assign(new Error((data as { error?: string }).error ?? '오류 발생'), {
        step: (data as { step?: string }).step,
      });
    }
    return data;
  }

  async function runPipeline() {
    if (!topic.trim() || isRunning) return;
    resetSteps();
    setIsRunning(true);

    let slug = '';
    let projectId = '';
    let siteUrl = '';
    let sitemapUrl = '';
    let genPages: PseoPage[] = [];
    let genTheme: SiteTheme | null = null;

    try {
      // [1] AI 콘텐츠 & 테마 생성 — SSE 스트리밍
      setStep('generate', 'running', '주제 분석 중...');

      let genRes: Response;
      try {
        genRes = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: topic.trim() }),
          signal: AbortSignal.timeout(180_000),
        });
      } catch (e) {
        const msg = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')
          ? '요청 시간 초과. 재시도해주세요.'
          : '네트워크 오류. 재시도해주세요.';
        throw Object.assign(new Error(msg), { step: 'generate' });
      }

      if (!genRes.body) throw Object.assign(new Error('스트림 응답 없음'), { step: 'generate' });

      const reader = genRes.body.getReader();
      const decoder = new TextDecoder();
      let sseBuf = '';
      let pageIndex = 0;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuf += decoder.decode(value, { stream: true });
        const lines = sseBuf.split('\n');
        sseBuf = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith(':')) continue; // keepalive
          if (!line.startsWith('data: ')) continue;
          let ev: { type: string; [k: string]: unknown };
          try { ev = JSON.parse(line.slice(6)) as { type: string; [k: string]: unknown }; } catch { continue; }

          if (ev.type === 'theme') {
            genTheme = ev.theme as SiteTheme;
            setThemeInfo(`${genTheme.mood} · ${genTheme.primaryColor} · ${genTheme.fontPair.heading}`);
          } else if (ev.type === 'page') {
            const page = ev.page as PseoPage;
            genPages = [...genPages, page];
            pageIndex = (ev.index as number) + 1;
            setStep('generate', 'running', `페이지 ${pageIndex}/5 생성 중... ${page.title.slice(0, 18)}`);
          } else if (ev.type === 'done') {
            slug = (ev.slug as string) || slug;
            genTheme = (ev.theme as SiteTheme) ?? genTheme;
            genPages = (ev.pages as PseoPage[]).length > 0 ? (ev.pages as PseoPage[]) : genPages;
            break outer;
          } else if (ev.type === 'error') {
            throw Object.assign(new Error(ev.message as string), { step: 'generate' });
          }
        }
      }

      if (!slug || genPages.length === 0 || !genTheme) {
        throw Object.assign(new Error('AI 생성 데이터가 불완전합니다. 재시도해주세요.'), { step: 'generate' });
      }
      setStep('generate', 'done', `${genTheme.mood} 테마 · ${genPages.length}페이지`);

      // [2] 페이지 빌드 & SEO 검증
      setStep('build', 'running');
      const buildResult = await apiPost<{
        files: Record<string, string>;
        slug: string;
        siteUrl: string;
        sitemapUrl: string;
      }>('/api/build', { slug, pages: genPages, theme: genTheme });
      slug = buildResult.slug; // 중복 시 suffix 붙은 slug로 업데이트
      siteUrl = buildResult.siteUrl;
      sitemapUrl = buildResult.sitemapUrl;
      setStep('build', 'done', `${Object.keys(buildResult.files).length}개 파일 생성`);

      // [3] GitHub 커밋
      setStep('github', 'running');
      const deployResult = await apiPost<{ commitSha: string; projectId: string }>(
        '/api/deploy',
        { slug, files: buildResult.files }
      );
      setStep('github', 'done', deployResult.commitSha.slice(0, 8));
      projectId = deployResult.projectId;

      // [4] Vercel 배포 대기 — 클라이언트 폴링 (10초 × 12회)
      setStep('vercel', 'running');
      let deployUrl = '';
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 10_000));
        try {
          const poll = await apiPost<{ state: string; deployUrl?: string }>(
            '/api/poll-deploy',
            { commitSha: deployResult.commitSha, projectId }
          );
          if (poll.state === 'READY' && poll.deployUrl) { deployUrl = poll.deployUrl; break; }
          if (poll.state === 'ERROR' || poll.state === 'CANCELED') {
            throw new Error(`Vercel 배포 실패 (${poll.state})`);
          }
        } catch (pollErr) {
          if (i === 11) throw pollErr;
        }
      }
      if (!deployUrl) throw Object.assign(new Error('Vercel 배포 타임아웃: 120초 내 READY 미확인'), { step: 'vercel' });
      setStep('vercel', 'done', deployUrl.replace('https://', '').slice(0, 40) + '…');

      // [5] 서브도메인 연결
      setStep('domain', 'running');
      await apiPost('/api/domain', { slug, projectId });
      setStep('domain', 'done', `${slug}.${BASE_DOMAIN}`);

      // 배포 완료 — 즉시 URL 표시
      const url = `https://${slug}.${BASE_DOMAIN}`;
      setFinalUrl(url);
      saveHistory({ topic: topic.trim(), slug, url, createdAt: Date.now() });

      // [6] 서치콘솔 등록 — 백그라운드 fire-and-forget
      setStep('index', 'running', '백그라운드 처리 중...');
      const pageUrls = genPages.map((p) => `https://${slug}.${BASE_DOMAIN}/${p.slug}`);
      void apiPost<{
        google: { ok: boolean; skipped: boolean };
        googleIndexing: { ok: boolean; skipped: boolean; submittedUrls?: number };
        naver: { ok: boolean; skipped: boolean };
      }>('/api/postprocess', { slug, siteUrl, sitemapUrl, pageUrls }, 30_000)
        .then((r) => {
          const detail = [
            `구글: ${r.google.skipped ? 'skip' : r.google.ok ? '✅' : '❌'}`,
            `인덱싱API: ${r.googleIndexing.skipped ? 'skip' : r.googleIndexing.ok ? `✅(${r.googleIndexing.submittedUrls ?? 0})` : '❌'}`,
            `네이버: ${r.naver.skipped ? 'skip' : r.naver.ok ? '✅' : '❌'}`,
          ].join(' · ');
          setStep('index', 'done', detail);
          const isOk = r.google.ok || r.googleIndexing.ok || r.naver.ok;
          const allSkip = r.google.skipped && r.googleIndexing.skipped && r.naver.skipped;
          updateIndexLog({ slug, url, timestamp: Date.now() }, isOk || allSkip);
        })
        .catch(() => setStep('index', 'skipped', '등록 실패 (재시도 가능)'));

    } catch (err) {
      const error = err as Error & { step?: string };
      const failedStep = error.step ?? currentStepRef.current;
      if (failedStep) setStep(failedStep, 'error', undefined, error.message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            pSEO Factory
          </h1>
          <p className="text-slate-400">
            주제 하나로 SEO 최적화 사이트를 자동 생성·배포
          </p>
        </div>

        {/* Input */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            사이트 주제
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runPipeline()}
              placeholder="예: 서울 어린이날 행사 장소, 강남 맛집 추천"
              disabled={isRunning}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              onClick={runPipeline}
              disabled={isRunning || !topic.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors whitespace-nowrap"
            >
              {isRunning ? '생성 중...' : '실행'}
            </button>
          </div>
          {themeInfo && (
            <p className="mt-2 text-xs text-slate-400">🎨 테마: {themeInfo}</p>
          )}
        </div>

        {/* Pipeline Status */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-6">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            파이프라인 진행 상태
          </h2>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={step.id}>
                <div className="flex items-center gap-3">
                  <span className="text-slate-600 text-xs w-4 text-right">{i + 1}</span>
                  <StepIcon status={step.status} />
                  <span
                    className={
                      step.status === 'done'    ? 'text-green-400' :
                      step.status === 'running' ? 'text-blue-400 font-medium' :
                      step.status === 'error'   ? 'text-red-400' :
                      step.status === 'skipped' ? 'text-slate-600' :
                                                  'text-slate-500'
                    }
                  >
                    {step.label}
                  </span>
                  <span className="ml-auto text-xs">
                    {step.status === 'running' && <span className="text-blue-400 animate-pulse">진행 중</span>}
                    {step.status === 'done' && step.detail && <span className="text-slate-400">{step.detail}</span>}
                    {step.status === 'skipped' && <span className="text-slate-600">skip</span>}
                  </span>
                </div>
                {step.status === 'error' && step.error && (
                  <p className="mt-1 ml-12 text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded">
                    {step.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Success Result */}
        {finalUrl && (
          <div className="bg-green-900/30 border border-green-500/50 rounded-2xl p-6 mb-6 text-center">
            <p className="text-green-400 font-semibold mb-2">🎉 배포 완료!</p>
            <a
              href={finalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {finalUrl}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Indexing Log Stats (추가 9) */}
        {(indexLog.success.length > 0 || indexLog.failed.length > 0) && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-6">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
              인덱싱 현황
            </h2>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 bg-green-900/20 border border-green-800/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{indexLog.success.length}</p>
                <p className="text-xs text-slate-400 mt-1">성공</p>
              </div>
              <div className="flex-1 bg-red-900/20 border border-red-800/30 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{indexLog.failed.length}</p>
                <p className="text-xs text-slate-400 mt-1">실패</p>
              </div>
            </div>
            {indexLog.failed.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">실패 목록</p>
                <div className="space-y-1">
                  {indexLog.failed.slice(0, 5).map((item) => (
                    <div key={item.slug} className="flex items-center justify-between py-1.5 px-3 bg-slate-700/50 rounded-lg">
                      <span className="text-xs text-slate-300 truncate flex-1">{item.slug}</span>
                      <button
                        onClick={() => retryIndex(item.slug)}
                        className="text-xs text-blue-400 hover:text-blue-300 ml-3 whitespace-nowrap"
                      >
                        재시도
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 내 사이트 관리 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              내 사이트 관리
            </h2>
            <button
              onClick={() => void fetchSites()}
              disabled={sitesLoading}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
            >
              {sitesLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              새로고침
            </button>
          </div>

          {sitesLoading && sites.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-700/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : sites.length === 0 ? (
            <p className="text-center text-slate-600 text-sm py-8">생성된 사이트가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {sites.map((site) => {
                if (!site.theme) return null; // 구조 불일치 스킵
                const topic = history.find((h) => h.slug === site.slug)?.topic;
                const siteUrl = `https://${site.slug}.${BASE_DOMAIN}`;
                const isExpanded = expandedSlug === site.slug;
                const isConfirming = confirmDelete === site.slug;
                const isDeleting = deletingSlug === site.slug;

                return (
                  <div key={site.slug} className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900/50">
                    {/* 테마 그라디언트 헤더 */}
                    <div
                      className="h-2"
                      style={{
                        background: `linear-gradient(${site.theme.gradientDirection}, ${site.theme.primaryColor}, ${site.theme.secondaryColor})`,
                      }}
                    />

                    <div className="p-4">
                      {/* 제목 행 */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white truncate text-sm">
                            {topic ?? site.slug}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{site.slug}</p>
                        </div>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: `${site.theme.primaryColor}20`,
                            color: site.theme.primaryColor,
                          }}
                        >
                          {site.theme.mood}
                        </span>
                      </div>

                      {/* 메타 정보 */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                        <span>{site.pages.length}페이지</span>
                        <span>·</span>
                        <span>{new Date(site.generatedAt).toLocaleDateString('ko-KR')}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-green-500">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="4" />
                          </svg>
                          배포 완료
                        </span>
                      </div>

                      {/* 페이지 목록 (펼치기) */}
                      <button
                        onClick={() => setExpandedSlug(isExpanded ? null : site.slug)}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 mb-2 transition-colors"
                      >
                        <svg
                          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        페이지 목록 {isExpanded ? '접기' : '보기'}
                      </button>

                      {isExpanded && (
                        <div className="mb-3 space-y-1 pl-4 border-l-2" style={{ borderColor: site.theme.primaryColor + '40' }}>
                          {site.pages.map((page, i) => (
                            <div key={page.slug} className="flex items-center gap-2">
                              <span className="text-xs text-slate-600">{i + 1}.</span>
                              <a
                                href={`${siteUrl}${page.slug === site.slug || page.slug === 'index' ? '' : '/' + page.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-slate-300 hover:text-white truncate transition-colors"
                              >
                                {page.title}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2">
                        <a
                          href={siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-center text-xs py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          방문
                        </a>

                        {!isConfirming ? (
                          <button
                            onClick={() => setConfirmDelete(site.slug)}
                            className="flex-1 text-xs py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400 transition-colors flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            삭제
                          </button>
                        ) : (
                          <div className="flex-1 flex gap-1">
                            <button
                              onClick={() => void deleteSite(site.slug)}
                              disabled={isDeleting}
                              className="flex-1 text-xs py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-1 disabled:opacity-60"
                            >
                              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : '확인'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="flex-1 text-xs py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4" />
                생성 이력
              </h2>
              <button onClick={clearHistory} className="text-slate-600 hover:text-red-400 transition-colors" title="이력 삭제">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.slug} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-300">{item.topic}</p>
                    <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('ko-KR')}</p>
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    {item.url.replace('https://', '')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
