'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Bot, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formSchema = z.object({
  topic: z
    .string()
    .min(5, { message: '주제는 최소 5자 이상이어야 합니다.' })
    .max(100, { message: '주제는 100자를 초과할 수 없습니다.' }),
  requirements: z
    .string()
    .max(500, { message: '요구사항은 500자를 초과할 수 없습니다.' })
    .optional(),
});

export type FormValues = z.infer<typeof formSchema>;

interface GeneratorFormProps {
  onGenerate: (values: FormValues) => void;
  isGenerating: boolean;
}

export function GeneratorForm({ onGenerate, isGenerating }: GeneratorFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: '',
      requirements: '',
    },
  });

  function onSubmit(values: FormValues) {
    onGenerate(values);
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Bot className="h-7 w-7" />
          새 사이트 만들기
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">주요 주제</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='예: "서울 어린이날 행사 장소"'
                      {...field}
                      className="text-base"
                    />
                  </FormControl>
                  <FormDescription>
                    새 웹사이트의 중심 테마입니다.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">키워드 및 요구사항 (선택)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='예: "가족 친화적, 야외 활동, 합리적인 가격"'
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    특정 키워드, 타겟 독자, 또는 기타 SEO 요구사항을 추가하세요.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isGenerating} className="w-full text-lg py-6 bg-accent hover:bg-accent/90">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-5 w-5" />
                  AI로 사이트 생성하기
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
