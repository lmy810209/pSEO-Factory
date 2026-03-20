'use server';

import { generateSiteContentAndStructure } from '@/ai/flows/generate-site-content-and-structure-flow';
import type { SiteGenerationResult } from './types';

interface ActionResult {
  success: boolean;
  data?: SiteGenerationResult;
  error?: string;
}

export async function generateSite(data: {
  topic: string;
  requirements?: string;
}): Promise<ActionResult> {
  try {
    const result = await generateSiteContentAndStructure({
      topic: data.topic,
      requirements: data.requirements,
    });
    
    if (!result || !result.pages || result.pages.length === 0) {
      return { success: false, error: 'The AI failed to generate any pages. Please try a different topic.' };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Error generating site:', error);
    // Provide a user-friendly error message
    const errorMessage = error instanceof Error ? 
      `An error occurred during generation: ${error.message}` : 
      'An unknown error occurred. Please try again.';
    
    return { success: false, error: errorMessage };
  }
}
