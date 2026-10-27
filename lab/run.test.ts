// Run with: npx vitest run --config lab/vitest.config.ts [-t theme-name]
import { writeFileSync, mkdirSync } from 'node:fs';
import { test } from 'vitest';
import { fmt } from './analyze';
import { lastStats, search } from './generate';
import { THEMES } from './themes';
import { THEMES2 } from './themes2';
import { THEMES3 } from './themes3';
import { THEMES4 } from './themes4';
import { THEMES5 } from './themes5';

mkdirSync(new URL('./out/', import.meta.url), { recursive: true });

const ROUNDS: Record<string, typeof THEMES> = { '1': THEMES, '2': THEMES2, '3': THEMES3, '4': THEMES4, '5': THEMES5 };
for (const theme of ROUNDS[process.env.ROUND ?? '1']) {
  test(theme.name, () => {
    const t0 = Date.now();
    const seed = Number(process.env.SEED ?? 1);
    const best = search({ ...theme, attempts: Math.ceil(theme.attempts * Number(process.env.MULT ?? 1)) }, seed, Number(process.env.KEEP ?? 4));
    const body = best.map((c, i) => `#${i} score=${c.score.toFixed(1)} ${fmt(c.data, c.a)}`).join('\n\n');
    writeFileSync(new URL(`./out/${theme.name}.txt`, import.meta.url), `${theme.name} (${Date.now() - t0}ms) ${JSON.stringify(lastStats)}\n\n${body}\n`);
  });
}
