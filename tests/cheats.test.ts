import { describe, expect, test } from 'vitest';
import { CheatListener, type CheatToken } from '../src/cheats';

const feed = (l: CheatListener, s: string) => {
  let hit = null;
  for (const tok of s.split(' ')) hit = l.push(tok as CheatToken) ?? hit;
  return hit;
};

describe('cheat codes', () => {
  test('Konami code unlocks hints, with keys or with a double tap', () => {
    expect(feed(new CheatListener(), 'U U D D L R L R B A')).toBe('hints');
    expect(feed(new CheatListener(), 'U U D D L R L R TAP2')).toBe('hints');
  });

  test('the backwards code unlocks solutions', () => {
    expect(feed(new CheatListener(), 'D D U U R L R L A B')).toBe('solutions');
    expect(feed(new CheatListener(), 'D D U U R L R L TAP2')).toBe('solutions');
  });

  test('noise before the code is fine; wrong order is not', () => {
    expect(feed(new CheatListener(), 'L A U L U U D D L R L R B A')).toBe('hints');
    expect(feed(new CheatListener(), 'U U D D L R L R A B')).toBeNull();
    expect(feed(new CheatListener(), 'U U D D R L R L B A')).toBeNull();
    expect(feed(new CheatListener(), 'U U D L R L R B A')).toBeNull();
  });

  test('the buffer resets after a match', () => {
    const l = new CheatListener();
    expect(feed(l, 'U U D D L R L R B A')).toBe('hints');
    expect(l.push('A')).toBeNull();
  });
});
