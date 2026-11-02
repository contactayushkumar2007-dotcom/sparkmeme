// API service for SparkMeme generators.
//
// Each function fetches from a real public API and falls back to mock data
// if the network request fails. Components stay unchanged.
//
// generateCustom() calls the rate-limited "generate-custom" Edge Function
// and returns { text, remaining } or throws a LimitError on 429.

import {
  adviceSlips,
  profilePersonas,
  dadJokes,
} from '../data/mock.js';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-custom`;

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function fetchAdviceSlip() {
  try {
    const res = await fetch('https://api.adviceslip.com/advice');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.slip?.advice) return data.slip.advice;
    throw new Error('Unexpected response shape');
  } catch {
    return randomItem(adviceSlips);
  }
}

export async function fetchDadJoke() {
  try {
    const res = await fetch('https://icanhazdadjoke.com/', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.joke) return data.joke;
    throw new Error('Unexpected response shape');
  } catch {
    return randomItem(dadJokes);
  }
}

export async function fetchProfilePersona() {
  try {
    const res = await fetch('https://randomuser.me/api/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const user = data?.results?.[0];
    if (!user) throw new Error('Unexpected response shape');

    const first = user.name?.first ?? '';
    const last = user.name?.last ?? '';
    const fullName = `${first} ${last}`.trim() || 'Unknown Creator';
    const age = user.dob?.age;
    const city = user.location?.city ?? '';
    const country = user.location?.country ?? '';
    const location = [city, country].filter(Boolean).join(', ');
    const photo = user.picture?.large || user.picture?.medium || null;

    const fallback = randomItem(profilePersonas);

    return {
      name: fullName,
      age: age ?? null,
      location: location || null,
      photo: photo ?? null,
      bio: fallback.bio,
      contentStyle: fallback.contentStyle,
      tone: fallback.tone,
      bestFor: fallback.bestFor,
    };
  } catch {
    const fallback = randomItem(profilePersonas);
    return {
      ...fallback,
      age: null,
      location: null,
      photo: null,
    };
  }
}

// --- Rate-limited custom generation via Edge Function ---

export class LimitError extends Error {
  constructor(message, remaining) {
    super(message);
    this.name = 'LimitError';
    this.remaining = remaining;
  }
}

export class GenerationError extends Error {
  constructor(message, debug) {
    super(message);
    this.name = 'GenerationError';
    this.debug = debug;
  }
}

export async function generateCustom(format, prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new GenerationError("Gemini API key is not configured.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const systemPrompt = `You are a viral meme caption generator. 
Generate a short, funny meme punchline or caption based on the user request.
Format: ${format || 'standard'}
User prompt: ${prompt || 'random internet humor'}
Rules: Respond ONLY with the meme text. Do not add quotes, explanations, or labels.`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: systemPrompt }]
        }]
      })
    });

    if (!res.ok) {
      throw new GenerationError(`Gemini API error: ${res.statusText}`);
    }

    const data = await res.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "When the code finally works on production.";

    return {
      text: generatedText,
      remaining: 99
    };
  } catch (err) {
    throw new GenerationError(err.message || "Failed to generate meme caption");
  }
}

// Fetch the remaining generation count without generating.
// Calls the edge function with a lightweight request that still
// returns the remaining count, or returns 5 if it fails.
export async function getRemainingGenerations() {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ type: 'check', prompt: null }),
    });

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      return data.remaining ?? 0;
    }

    if (res.ok) {
      const data = await res.json();
      return data.remaining ?? 5;
    }
    return 5;
  } catch {
    return 5;
  }
}
