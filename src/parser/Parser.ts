import type { DraftEvent } from '../domain/types';
export interface ParseInput { text: string; defaultDate: string; rawLogId: string; }
export interface ParseResult { events: DraftEvent[]; parserName: string; warnings: string[]; }
export interface Parser { parse(input: ParseInput): Promise<ParseResult>; }
