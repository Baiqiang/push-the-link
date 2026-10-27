// Difficulty report for the shipped levels: npx vitest run --config lab/vitest.config.ts lab/report.test.ts
import { test } from 'vitest';
import { LEVELS } from '../src/engine';
import { analyze } from './analyze';

test('report', () => {
  const rows = LEVELS.map((lv) => {
    const a = analyze(lv, 400_000);
    return `${String(lv.id).padStart(2)} ${lv.data.title.zh.padEnd(6, '　')} opt=${a.optimal} paths=${a.optimalPaths} dead=${(a.deadFrac * 100).toFixed(0)}% trap=${(a.trapRate * 100).toFixed(0)}% pushes=${a.pushes} sw=${a.switches} back=${a.regress} states=${a.reachable}`;
  });
  console.log(rows.join('\n'));
});
