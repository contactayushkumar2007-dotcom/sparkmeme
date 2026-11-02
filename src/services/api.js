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
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ type: 'generate', format, prompt }),
  });

  if (res.status === 429) {
    const data = await res.json().catch(() => ({}));
    throw new LimitError(
      data.message || "You've reached today's free limit. Come back tomorrow.",
      data.remaining ?? 0
    );
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new GenerationError(
      data.message || `Request failed (${res.status})`,
      data.debug
    );
  }

  const data = await res.json();
  return {
    text: data.text ?? '',
    remaining: data.remaining ?? 0,
  };
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
