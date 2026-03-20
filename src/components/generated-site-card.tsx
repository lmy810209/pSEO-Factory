'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SiteGenerationResult } from '@/lib/types';
import { Rocket, Globe, FileText, Key, BookOpen } from 'lucide-react';

interface GeneratedSiteCardProps {
  site: SiteGenerationResult;
}

export function GeneratedSiteCard({ site }: GeneratedSiteCardProps) {
  return (
    <Card className="w-full max-w-4xl mx-auto shadow-md hover:shadow-xl transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex items-center gap-3">
            <Globe className="h-7 w-7 text-primary" />
            {site.siteTitle}
        </CardTitle>
        <CardDescription>{site.metaDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <h3 className="text-lg font-semibold mb-4">생성된 페이지 ({site.pages.length})</h3>
        <Accordion type="single" collapsible className="w-full">
          {site.pages.map((page, index) => (
            <AccordionItem value={`item-${index}`} key={index}>
              <AccordionTrigger className="hover:bg-muted/50 px-4 rounded-md">
                <div className="flex flex-col md:flex-row md:items-center gap-2 text-left">
                  <span className="font-medium text-primary">{page.title}</span>
                  <Badge variant="outline" className="w-fit">{page.slug}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-4 bg-muted/30 rounded-b-md">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" />H1 제목</h4>
                    <p className="pl-6 text-muted-foreground">{page.h1}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />메타 설명</h4>
                    <p className="pl-6 text-muted-foreground">{page.metaDescription}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold flex items-center gap-2"><Key className="h-4 w-4 text-muted-foreground" />키워드</h4>
                    <div className="pl-6 flex flex-wrap gap-2 mt-1">
                      {page.keywords.map((keyword, i) => (
                        <Badge key={i} variant="secondary">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold">본문 내용</h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground space-y-3 mt-1 pl-6">
                      {page.bodyContent.map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
      <CardFooter className="flex justify-end">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
                <div tabIndex={0}>
                    <Button disabled>
                        <Rocket className="mr-2 h-4 w-4" />
                        Vercel에 배포하기
                    </Button>
                </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>배포 기능은 곧 출시될 예정입니다!</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );
}
