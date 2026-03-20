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
          title: 'Success!',
          description: 'Your new site structure has been generated.',
        });
      } else {
        throw new Error(result.error || 'An unknown error occurred.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate site.';
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
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
            Instantly Generate SEO-Optimized Websites
          </h1>
          <p className="mt-4 text-lg md:text-xl text-muted-foreground">
            Just provide a topic, and our AI will build a complete, multi-page site structure ready for deployment.
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
              <p className="text-lg font-medium">Generating your site...</p>
              <p>This may take a moment. Please wait.</p>
            </div>
          )}
          
          {generatedSites.length > 0 && (
             <div className="space-y-6">
                <h2 className="text-2xl md:text-3xl font-bold text-center text-foreground">
                    Generated Sites
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
                <h3 className="mt-4 text-lg font-medium text-foreground">No sites generated yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">Use the form above to create your first AI-powered website.</p>
            </div>
          )}
        </section>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} GenSite AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
