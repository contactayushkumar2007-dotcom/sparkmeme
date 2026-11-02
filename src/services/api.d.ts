// Type declarations for the JS API service so TypeScript can infer return types.

import type { PersonaResult } from '../types';

export function fetchAdviceSlip(): Promise<string>;
export function fetchDadJoke(): Promise<string>;
export function fetchProfilePersona(): Promise<PersonaResult>;

export class LimitError extends Error {
  remaining: number;
}

export class GenerationError extends Error {
  debug: string;
}

export interface CustomResult {
  text: string;
  remaining: number;
}

export function generateCustom(format: string, prompt?: string | null): Promise<CustomResult>;
export function getRemainingGenerations(): Promise<number>;
