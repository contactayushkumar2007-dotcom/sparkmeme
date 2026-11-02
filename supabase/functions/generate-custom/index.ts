// generate-custom Edge Function
//
// Rate-limited AI generation endpoint for SparkMeme.
// - Calls Google Gemini (gemini-3.8-flash) with automatic retries and a
//   gemini-3.8-flash-lite fallback.
// - Hashes visitor IP (SHA-256) and never stores raw IP.
// - Enforces per-visitor (5/24h) and global (100/24h) generation limits.
// - Rejects prompts longer than 200 characters.
// - Returns 429 when a limit is hit, with { error: "limit", message: "..." }.
// - If the Gemini call fails, deletes the usage_log row so it doesn't count.
// - Requires the GEMINI_API_KEY secret for the Google Gemini API call.
// - Logs Gemini API errors to console.error (status + body, never the key).

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PER_VISITOR_LIMIT = 5;
const GLOBAL_LIMIT = 100;
const MAX_PROMPT_LENGTH = 200;

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";
const GEMINI_FALLBACK_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite:generateContent";

const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

const SYSTEM_INSTRUCTION =
  "You write short, funny, original, family-friendly content for content creators. Reply with only the final text.";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "0.0.0.0";
}

async function countUsage(ipHash: string): Promise<{ perVisitor: number; global: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [visitorRes, globalRes] = await Promise.all([
    supabase
      .from("usage_log")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since),
    supabase
      .from("usage_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);

  return {
    perVisitor: visitorRes.count ?? 0,
    global: globalRes.count ?? 0,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiOnce(
  endpoint: string,
  format: string,
  prompt: string | null,
  label: string
): Promise<string> {
  const userText = `${format}. ${prompt ?? ""}`.trim();

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userText }],
      },
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": geminiApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "unreadable");
    console.error(`[${label}] Gemini API returned status ${res.status}. Response body:`, errBody);
    const err = new Error(`Gemini API error (${res.status})`);
    (err as any).geminiStatus = res.status;
    (err as any).geminiBody = errBody;
    throw err;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const bodyStr = JSON.stringify(data);
    console.error(`[${label}] Gemini API returned status ${res.status} but no content. Full response:`, bodyStr);
    const err = new Error("Gemini returned no content.");
    (err as any).geminiStatus = res.status;
    (err as any).geminiBody = bodyStr;
    throw err;
  }
  return text.trim();
}

async function callGemini(format: string, prompt: string | null): Promise<string> {
  let lastErr: unknown;

  // Primary model: up to 3 attempts (initial + 2 retries) on 429/503
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callGeminiOnce(GEMINI_ENDPOINT, format, prompt, "primary");
    } catch (err) {
      lastErr = err;
      const status = (err as any).geminiStatus as number | undefined;
      const retryable = status !== undefined && RETRYABLE_STATUS.has(status);
      if (!retryable || attempt === MAX_RETRIES) break;
      await sleep(RETRY_DELAY_MS);
    }
  }

  // Fallback model: single attempt
  try {
    return await callGeminiOnce(GEMINI_FALLBACK_ENDPOINT, format, prompt, "fallback");
  } catch (err) {
    // Keep the primary error as the reported one, but log the fallback failure
    const status = (err as any).geminiStatus as number | undefined;
    const errBody = (err as any).geminiBody as string | undefined;
    console.error(`[fallback] Gemini API returned status ${status}. Response body:`, errBody);
    throw lastErr;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type, format, prompt } = body;

    // Hash the visitor IP
    const rawIp = getClientIp(req);
    const ipHash = await hashIp(rawIp);

    // Check usage limits
    const { perVisitor, global } = await countUsage(ipHash);

    // "check" type: return remaining count without logging or generating
    if (type === "check") {
      const remaining = Math.max(0, PER_VISITOR_LIMIT - perVisitor);
      return new Response(
        JSON.stringify({ remaining }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate prompt length
    if (typeof prompt === "string" && prompt.length > MAX_PROMPT_LENGTH) {
      return new Response(
        JSON.stringify({
          error: "invalid_prompt",
          message: `Prompt must be 200 characters or fewer (got ${prompt.length}).`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (perVisitor >= PER_VISITOR_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "limit",
          message: "You've reached today's free limit. Come back tomorrow.",
          remaining: 0,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (global >= GLOBAL_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "limit",
          message: "Daily generation limit reached for all users. Come back tomorrow.",
          remaining: PER_VISITOR_LIMIT - perVisitor,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log this generation BEFORE calling the AI API
    const { data: insertedRow, error: insertError } = await supabase
      .from("usage_log")
      .insert({ ip_hash: ipHash })
      .select("id")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "internal", message: "Failed to log usage." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const logId = insertedRow.id;

    // Call the Gemini API
    let aiText: string;
    try {
      aiText = await callGemini(format ?? "Short post", prompt ?? null);
    } catch (aiErr) {
      // Delete the usage_log row so this failed attempt doesn't count
      await supabase.from("usage_log").delete().eq("id", logId);

      const geminiStatus = (aiErr as any).geminiStatus as number | undefined;
      const geminiBody = (aiErr as any).geminiBody as string | undefined;
      const debug =
        geminiStatus !== undefined
          ? `Gemini HTTP ${geminiStatus}: ${geminiBody ?? "unreadable"}`
          : undefined;

      return new Response(
        JSON.stringify({
          error: "ai_failed",
          message: "Couldn't generate content right now. Please try again.",
          remaining: PER_VISITOR_LIMIT - perVisitor,
          ...(debug ? { debug } : {}),
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const remaining = PER_VISITOR_LIMIT - perVisitor - 1;

    return new Response(
      JSON.stringify({
        format: format ?? null,
        prompt: prompt ?? null,
        text: aiText,
        remaining,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "internal", message: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
