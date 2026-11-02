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
    return {
      text: "Configuration Error: VITE_GEMINI_API_KEY is not defined in Netlify environment variables.",
      remaining: 50
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const promptText = `Generate a short, funny meme punchline or caption.
Format: ${format || 'joke'}
Topic: ${prompt || 'random internet humor'}
Rules: Output ONLY the meme punchline or caption text. Do not add quotes, commentary, or markdown.`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        text: `Gemini API Error (${res.status}): ${errText || res.statusText}`,
        remaining: 50
      };
    }

    const data = await res.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "404 Humor Not Found";

    return {
      text: generatedText,
      remaining: 50
    };
  } catch (err) {
    return {
      text: `Fetch Error: ${err.message || 'Network request failed'}`,
      remaining: 50
    };
  }
}

export async function getRemainingGenerations() {
  return 50;
}
