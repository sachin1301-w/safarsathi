import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '..', '..', 'data');

/** Reads a mock JSON file from backend/data. */
export function loadData<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as T;
}
