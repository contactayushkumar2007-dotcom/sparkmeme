// Shared types for SparkMeme generator results and saved items.

export type GeneratorType = 'advice' | 'persona' | 'joke' | 'custom';

export type CustomFormat = 'Joke' | 'Meme caption' | 'Short post';

export interface PersonaResult {
  name: string;
  age: number | null;
  location: string | null;
  photo: string | null;
  bio: string;
  contentStyle: string;
  tone: string;
  bestFor: string;
}

export type GenerateResult = string | PersonaResult;

export interface SavedItem {
  id: string;
  type: GeneratorType;
  text: string;
  createdAt: number;
}
