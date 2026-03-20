'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, Circle, ExternalLink, History, Trash2 } from 'lucide-react';

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved) as HistoryItem[]);
    } catch { /* ignore */ }
    try {
      const log = localStorage.getItem(INDEX_LOG_KEY);
      if (log) setIndexLog(JSON.parse(log) as IndexLog);
    } catch { /* ignore */ }
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

    try {
      // [1] AI 콘텐츠 & 테마 생성
      setStep('generate', 'running');
      const genResult = await apiPost<{
        slug: string;
        pages: unknown[];
        theme: { mood: string; primaryColor: string; fontPair: { heading: string } };
      }>('/api/generate', { topic: topic.trim() }, 300_000);
      slug = genResult.slug;
      const { mood, primaryColor, fontPair } = genResult.theme;
      setThemeInfo(`${mood} · ${primaryColor} · ${fontPair.heading}`);
      setStep('generate', 'done', `${mood} 테마 · ${genResult.pages.length}페이지`);

      // [2] 페이지 빌드 & SEO 검증
      setStep('build', 'running');
      const buildResult = await apiPost<{
        files: Record<string, string>;
        siteUrl: string;
        sitemapUrl: string;
      }>('/api/build', { slug, pages: genResult.pages, theme: genResult.theme });
      siteUrl = buildResult.siteUrl;
      sitemapUrl = buildResult.sitemapUrl;
      setStep('build', 'done', `${Object.keys(buildResult.files).length}개 파일 생성`);

      // [3] GitHub 커밋 (빠른 반환 — Vercel 폴링 제외)
      setStep('github', 'running');
      const deployResult = await apiPost<{ commitSha: string; projectId: string }>(
        '/api/deploy',
        { slug, files: buildResult.files }
      );
      setStep('github', 'done', deployResult.commitSha.slice(0, 8));
      projectId = deployResult.projectId;

      // [4] Vercel 배포 대기 — 클라이언트에서 12회 폴링 (10초 간격, 최대 120초)
      setStep('vercel', 'running');
      let deployUrl = '';
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 10_000));
        try {
          const poll = await apiPost<{ state: string; deployUrl?: string }>(
            '/api/poll-deploy',
            { commitSha: deployResult.commitSha, projectId }
          );
          if (poll.state === 'READY' && poll.deployUrl) {
            deployUrl = poll.deployUrl;
            break;
          }
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

      // [6] 서치콘솔 등록 (키 없으면 skip)
      setStep('index', 'running');
      const pageUrls = (genResult.pages as Array<{ slug: string }>).map(
        (p) => `https://${slug}.${BASE_DOMAIN}/${p.slug}`
      );
      const indexResult = await apiPost<{
        google: { ok: boolean; skipped: boolean };
        googleIndexing: { ok: boolean; skipped: boolean; submittedUrls?: number };
        naver: { ok: boolean; skipped: boolean };
      }>('/api/index', { slug, siteUrl, sitemapUrl, pageUrls });

      const indexDetail = [
        `구글: ${indexResult.google.skipped ? 'skip' : indexResult.google.ok ? '✅' : '❌'}`,
        `인덱싱API: ${indexResult.googleIndexing.skipped ? 'skip' : indexResult.googleIndexing.ok ? `✅(${indexResult.googleIndexing.submittedUrls ?? 0})` : '❌'}`,
        `네이버: ${indexResult.naver.skipped ? 'skip' : indexResult.naver.ok ? '✅' : '❌'}`,
      ].join(' · ');
      setStep('index', 'done', indexDetail);

      // 인덱싱 로그 클라이언트 저장
      const isOk = indexResult.google.ok || indexResult.googleIndexing.ok || indexResult.naver.ok;
      const allSkipped = indexResult.google.skipped && indexResult.googleIndexing.skipped && indexResult.naver.skipped;
      updateIndexLog(
        { slug, url: `https://${slug}.${BASE_DOMAIN}`, timestamp: Date.now() },
        isOk || allSkipped
      );

      const url = `https://${slug}.${BASE_DOMAIN}`;
      setFinalUrl(url);
      saveHistory({ topic: topic.trim(), slug, url, createdAt: Date.now() });

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
