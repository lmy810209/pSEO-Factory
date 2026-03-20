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
    .min(5, { message: 'Topic must be at least 5 characters long.' })
    .max(100, { message: 'Topic cannot be longer than 100 characters.' }),
  requirements: z
    .string()
    .max(500, { message: 'Requirements cannot be longer than 500 characters.' })
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
          Create a New Site
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
                  <FormLabel className="text-lg">Main Topic</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., &quot;Children's Day event venues in Seoul&quot;"
                      {...field}
                      className="text-base"
                    />
                  </FormControl>
                  <FormDescription>
                    This is the central theme for your new website.
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
                  <FormLabel className="text-lg">Keywords & Requirements (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='e.g., "family-friendly, outdoor activities, budget-friendly options"'
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Add any specific keywords, target audience, or other SEO requirements.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isGenerating} className="w-full text-lg py-6 bg-accent hover:bg-accent/90">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-5 w-5" />
                  Generate Site with AI
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
