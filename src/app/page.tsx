'use client';

import { useState } from 'react';
import { Bot, FileText, Loader2 } from 'lucide-react';
import { Header } from '@/components/header';
import { GeneratorForm, type FormValues } from '@/components/generator-form';
import { GeneratedSiteCard } from '@/components/generated-site-card';
import { generateSite } from '@/lib/actions';
import type { SiteGenerationResult } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  const [generatedSites, setGeneratedSites] = useState<SiteGenerationResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerateSite = async (data: FormValues) => {
    setIsGenerating(true);
    try {
      const result = await generateSite(data);
      if (result.success && result.data) {
        setGeneratedSites(prevSites => [result.data!, ...prevSites]);
        toast({
          title: '성공!',
          description: '새 사이트 구조가 생성되었습니다.',
        });
      } else {
        throw new Error(result.error || 'An unknown error occurred.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate site.';
      toast({
        variant: 'destructive',
        title: '생성 실패',
        description: errorMessage,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 md:py-12">
        <section className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
            SEO 최적화 웹사이트를 즉시 생성하세요
          </h1>
          <p className="mt-4 text-lg md:text-xl text-muted-foreground">
            주제만 입력하면 AI가 배포 준비된 완전한 멀티페이지 사이트 구조를 자동으로 만들어 드립니다.
          </p>
        </section>

        <section className="mt-10 md:mt-16 max-w-2xl mx-auto">
          <GeneratorForm onGenerate={handleGenerateSite} isGenerating={isGenerating} />
        </section>

        {(isGenerating || generatedSites.length > 0) && (
          <Separator className="my-10 md:my-16" />
        )}

        <section className="space-y-8">
          {isGenerating && (
            <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground p-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">사이트를 생성하는 중...</p>
              <p>잠시 시간이 걸릴 수 있습니다. 잠깐만 기다려 주세요.</p>
            </div>
          )}
          
          {generatedSites.length > 0 && (
             <div className="space-y-6">
                <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground">
                    생성된 사이트
                </h2>
                <div className="grid gap-8">
                    {generatedSites.map((site, index) => (
                        <GeneratedSiteCard key={index} site={site} />
                    ))}
                </div>
            </div>
          )}

          {!isGenerating && generatedSites.length === 0 && (
            <div className="text-center py-16 px-4 border-2 border-dashed rounded-lg">
                <div className="mx-auto h-12 w-12 text-muted-foreground">
                    <FileText className="h-full w-full" />
                </div>
                <h3 className="mt-4 text-lg font-medium text-foreground">아직 생성된 사이트가 없습니다</h3>
                <p className="mt-2 text-sm text-muted-foreground">위의 양식을 사용하여 첫 번째 AI 웹사이트를 만들어 보세요.</p>
            </div>
          )}
        </section>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} GenSite AI. 모든 권리 보유.</p>
      </footer>
    </div>
  );
}
