const REQUIRED_VARS = [
  'ANTHROPIC_API_KEY',
  'VERCEL_TOKEN',
  'GITHUB_TOKEN',
  'GITHUB_REPO',
  'BASE_DOMAIN',
] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

type EnvVars = Record<RequiredVar, string> & {
  VERCEL_TEAM_ID?: string;
};

export function validateEnv(): EnvVars {
  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`필수 환경변수 누락: ${missing.join(', ')}`);
  }
  return {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
    VERCEL_TOKEN: process.env.VERCEL_TOKEN!,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN!,
    GITHUB_REPO: process.env.GITHUB_REPO!,
    BASE_DOMAIN: process.env.BASE_DOMAIN!,
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
  };
}
