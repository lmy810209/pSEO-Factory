'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle2, XCircle, Circle, ExternalLink, History, Trash2 } from 'lucide-react';

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  error?: string;
}

interface HistoryItem {
  topic: string;
  slug: string;
  url: string;
  createdAt: number;
}

const INITIAL_STEPS: Step[] = [
  { id: 'generate', label: 'AI 콘텐츠 생성', status: 'pending' },
  { id: 'build',    label: '페이지 빌드 & SEO 검증', status: 'pending' },
  { id: 'github',   label: 'GitHub 커밋', status: 'pending' },
  { id: 'vercel',   label: 'Vercel 배포 대기', status: 'pending' },
  { id: 'domain',   label: '서브도메인 연결', status: 'pending' },
];

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'igeol.kr';
const HISTORY_KEY = 'pseo_history';

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'running') return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
  if (status === 'done') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  if (status === 'error') return <XCircle className="w-5 h-5 text-red-500" />;
  return <Circle className="w-5 h-5 text-gray-300" />;
}

export default function Home() {
  const [topic, setTopic] = useState('');
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [isRunning, setIsRunning] = useState(false);
  const [finalUrl, setFinalUrl] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const vercelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved) as HistoryItem[]);
    } catch { /* ignore */ }
  }, []);

  function setStep(id: string, status: StepStatus, error?: string) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, error } : s))
    );
  }

  function resetSteps() {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: 'pending', error: undefined })));
    setFinalUrl('');
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

  async function apiPost<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as T & { error?: string; step?: string };
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

    try {
      // [1] AI 콘텐츠 생성
      setStep('generate', 'running');
      const genResult = await apiPost<{ slug: string; pages: unknown[] }>(
        '/api/generate',
        { topic: topic.trim() }
      );
      slug = genResult.slug;
      setStep('generate', 'done');

      // [2] 페이지 빌드 & SEO 검증
      setStep('build', 'running');
      const buildResult = await apiPost<{ files: Record<string, string> }>(
        '/api/build',
        { slug, pages: genResult.pages }
      );
      setStep('build', 'done');

      // [3] GitHub 커밋 (deploy API 호출 시작 → 즉시 running 표시)
      setStep('github', 'running');
      // 3초 후 Vercel 단계도 running으로 전환 (GitHub push 후 Vercel이 감지하는 시간)
      vercelTimerRef.current = setTimeout(() => {
        setStep('vercel', 'running');
      }, 3000);

      const deployResult = await apiPost<{ deployUrl: string; projectId: string }>(
        '/api/deploy',
        { slug, files: buildResult.files }
      );

      if (vercelTimerRef.current) clearTimeout(vercelTimerRef.current);
      setStep('github', 'done');
      setStep('vercel', 'done');
      projectId = deployResult.projectId;

      // [5] 서브도메인 연결
      setStep('domain', 'running');
      await apiPost('/api/domain', { slug, projectId });
      setStep('domain', 'done');

      const url = `https://${slug}.${BASE_DOMAIN}`;
      setFinalUrl(url);
      saveHistory({ topic: topic.trim(), slug, url, createdAt: Date.now() });

    } catch (err) {
      if (vercelTimerRef.current) clearTimeout(vercelTimerRef.current);
      const error = err as Error & { step?: string };
      const failedStep = error.step ?? steps.find((s) => s.status === 'running')?.id;
      if (failedStep) {
        setStep(failedStep, 'error', error.message);
      }
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
                      step.status === 'done'
                        ? 'text-green-400'
                        : step.status === 'running'
                        ? 'text-blue-400 font-medium'
                        : step.status === 'error'
                        ? 'text-red-400'
                        : 'text-slate-500'
                    }
                  >
                    {step.label}
                  </span>
                  {step.status === 'running' && (
                    <span className="ml-auto text-xs text-blue-400 animate-pulse">진행 중</span>
                  )}
                  {step.status === 'done' && (
                    <span className="ml-auto text-xs text-green-500">완료</span>
                  )}
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

        {/* History */}
        {history.length > 0 && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4" />
                생성 이력
              </h2>
              <button
                onClick={clearHistory}
                className="text-slate-600 hover:text-red-400 transition-colors"
                title="이력 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.slug}
                  className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-300">{item.topic}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
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
