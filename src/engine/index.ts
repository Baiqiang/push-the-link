import rawLevels from '../data/levels.json';
import type { Level, LevelData } from './types';
import { parseLevel } from './level';

export * from './types';
export * from './links';
export * from './level';
export * from './step';
export * from './solver';

export const LEVELS: Level[] = (rawLevels as LevelData[]).map(parseLevel);
export * from './session';
