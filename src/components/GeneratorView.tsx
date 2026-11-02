import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Copy, Save, RefreshCw, Check, Loader2, AlertCircle } from 'lucide-react';
import type { GeneratorType, PersonaResult, SavedItem, CustomFormat } from '../types';
import {
  fetchAdviceSlip,
  fetchProfilePersona,
  fetchDadJoke,
  generateCustom,
  getRemainingGenerations,
  LimitError,
  GenerationError,
} from '../services/api.js';

const TITLES: Record<GeneratorType, string> = {
  advice: 'Advice Slips',
  persona: 'Profile Personas',
  joke: 'Dad Jokes',
  custom: 'Custom',
};

const SUBTITLES: Record<GeneratorType, string> = {
  advice: 'Wise, practical nuggets to spark your next post.',
  persona: 'Detailed creator personas with tone, style, and best-for.',
  joke: 'Groan-worthy one-liners to lighten your content.',
  custom: 'Write your own prompt and let AI generate content.',
};

const FORMATS: CustomFormat[] = ['Joke', 'Meme caption', 'Short post'];

const MAX_GENERATIONS = 5;
const MAX_PROMPT_LENGTH = 200;

interface GeneratorViewProps {
  type: GeneratorType;
  onBack: () => void;
  onSave: (item: SavedItem) => void;
}

export default function GeneratorView({ type, onBack, onSave }: GeneratorViewProps) {
  const [result, setResult] = useState<string | PersonaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorWithRetry, setErrorWithRetry] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const [remaining, setRemaining] = useState<number>(MAX_GENERATIONS);
  const [copied, setCopied] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [saved, setSaved] = useState(false);
  const [persona, setPersona] = useState<PersonaResult | null>(null);

  // Custom generator state
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<CustomFormat>('Joke');

  const isCustom = type === 'custom';

  // Fetch remaining generations on mount (custom only)
  useEffect(() => {
    if (!isCustom) return;
    let cancelled = false;
    getRemainingGenerations().then((count) => {
      if (cancelled) return;
      setRemaining(count);
      if (count <= 0) {
        setLimitReached(true);
        setLimitMessage("You've reached today's free limit. Come back tomorrow.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isCustom]);

  const generate = useCallback(async () => {
    if (limitReached) return;
    setLoading(true);
    setError(false);
    setErrorWithRetry(false);
    setCopied(false);
    setSaved(false);
    setPersona(null);
    setResult(null);
    setDebugInfo('');

    if (isCustom) {
      try {
        const custom = await generateCustom(format, prompt || null);
        setRemaining(custom.remaining);
        if (custom.remaining <= 0) {
          setLimitReached(true);
          setLimitMessage("You've reached today's free limit. Come back tomorrow.");
        }
        if (custom.text) {
          setResult(custom.text);
        } else {
          throw new Error('No result from AI');
        }
      } catch (err) {
        if (err instanceof LimitError) {
          setRemaining(err.remaining);
          setLimitReached(true);
          setLimitMessage(
            err.message || "You've reached today's free limit. Come back tomorrow."
          );
        } else {
          setError(true);
          if (err instanceof GenerationError && err.debug) {
            setDebugInfo(err.debug);
          }
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    // Non-custom generators: direct public APIs, no limits
    try {
      if (type === 'advice') {
        const text = await fetchAdviceSlip();
        if (!text) throw new Error('No result');
        setResult(text);
      } else if (type === 'persona') {
        const p = await fetchProfilePersona();
        if (!p) throw new Error('No result');
        setPersona(p);
        setResult(p.name);
      } else {
        const text = await fetchDadJoke();
        if (!text) throw new Error('No result');
        setResult(text);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [type, isCustom, format, prompt, limitReached]);

  const getDisplayText = useCallback((): string => {
    if (type === 'persona' && persona) {
      const parts = [
        persona.name,
        persona.age ? `Age: ${persona.age}` : null,
        persona.location ? `Location: ${persona.location}` : null,
        persona.bio,
        `Style: ${persona.contentStyle}`,
        `Tone: ${persona.tone}`,
        `Best for: ${persona.bestFor}`,
      ].filter(Boolean);
      return parts.join('\n');
    }
    return result as string;
  }, [type, persona, result]);

  const handleCopy = useCallback(async () => {
    const text = getDisplayText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable; silently ignore
    }
  }, [getDisplayText]);

  const handleSave = useCallback(() => {
    const text = getDisplayText();
    if (!text) return;
    onSave({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      text,
      createdAt: Date.now(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [getDisplayText, type, onSave]);

  const handleRegenerate = useCallback(() => {
    generate();
  }, [generate]);

  const handleBack = useCallback(() => onBack(), [onBack]);

  const generateDisabled = loading || limitReached || (isCustom && !prompt.trim());

  return (
    <div className="px-4 sm:px-8">
      <div className="max-w-2xl mx-auto pt-8 sm:pt-12">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors duration-150 mb-8"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back
        </button>

        <div className="mb-10">
          <h2 className="text-xl font-medium text-black">{TITLES[type]}</h2>
          <p className="text-xs text-gray-500 mt-1">{SUBTITLES[type]}</p>
        </div>

        {/* Custom generator: prompt input + format tabs */}
        {isCustom && (
          <div className="mb-8">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !generateDisabled) generate();
              }}
              placeholder="e.g. a joke about a tree"
              maxLength={MAX_PROMPT_LENGTH}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded text-black placeholder:text-gray-300 focus:outline-none focus:border-black transition-colors duration-150"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-4">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`text-xs transition-colors duration-150 ${
                      format === f
                        ? 'text-black font-medium'
                        : 'text-gray-400 hover:text-black'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-300">
                {prompt.length}/{MAX_PROMPT_LENGTH}
              </span>
            </div>
          </div>
        )}

        <div className="mb-10">
          <button
            onClick={generate}
            disabled={generateDisabled}
            className="px-5 py-2 text-sm font-medium border border-black rounded text-black bg-white hover:bg-black hover:text-white transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                Generating…
              </span>
            ) : (
              'Generate'
            )}
          </button>

          {isCustom && (
            <p className="text-xs text-gray-400 mt-3">
              {limitReached
                ? limitMessage
                : `${remaining} of ${MAX_GENERATIONS} free generations left today`}
            </p>
          )}
        </div>

        {/* Result area */}
        <div className="min-h-[200px]">
          {loading && (
            <div className="border border-gray-200 rounded p-8 flex items-center justify-center gap-2">
              <Loader2
                size={16}
                strokeWidth={1.5}
                className="animate-spin text-gray-400"
              />
              <span className="text-sm text-gray-400">Generating…</span>
            </div>
          )}

          {!loading && error && (
            <div className="border border-gray-200 rounded p-8 text-center animate-fade-in">
              <div className="flex items-center justify-center gap-2 mb-3">
                <AlertCircle size={16} strokeWidth={1.5} className="text-gray-400" />
                <p className="text-sm text-gray-500">
                  {isCustom
                    ? "Couldn't generate content right now. Please try again."
                    : 'Something went wrong. Please try again.'}
                </p>
              </div>
              {isCustom && debugInfo && (
                <p className="text-xs text-gray-400 mt-1 mb-3 break-words font-mono">
                  {debugInfo}
                </p>
              )}
              <button
                onClick={handleRegenerate}
                className="text-xs text-black underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && !result && !persona && !(isCustom && limitReached) && (
            <div className="border border-dashed border-gray-200 rounded p-10 text-center">
              <p className="text-sm text-gray-400">
                {isCustom
                  ? 'Enter a prompt and press Generate.'
                  : 'Press Generate to get a result.'}
              </p>
            </div>
          )}

          {!loading && type === 'persona' && persona && (
            <div className="border border-gray-200 rounded p-6 animate-fade-in">
              <div className="flex items-start gap-5">
                {persona.photo && (
                  <img
                    src={persona.photo}
                    alt={persona.name}
                    className="w-20 h-20 rounded object-cover border border-gray-200 flex-shrink-0 grayscale"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-base font-medium text-black">
                    {persona.name}
                  </div>
                  {(persona.age || persona.location) && (
                    <div className="text-xs text-gray-400 mt-1">
                      {[
                        persona.age ? `Age ${persona.age}` : null,
                        persona.location,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-700 leading-relaxed mt-4 mb-5">
                {persona.bio}
              </p>
              <dl className="space-y-3 text-xs">
                <div className="flex gap-2">
                  <dt className="text-gray-400 flex-shrink-0 w-16">Style</dt>
                  <dd className="text-gray-700">{persona.contentStyle}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-400 flex-shrink-0 w-16">Tone</dt>
                  <dd className="text-gray-700">{persona.tone}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-gray-400 flex-shrink-0 w-16">Best for</dt>
                  <dd className="text-gray-700">{persona.bestFor}</dd>
                </div>
              </dl>
            </div>
          )}

          {!loading && type !== 'persona' && typeof result === 'string' && result && (
            <div className="border border-gray-200 rounded p-8 animate-fade-in">
              <p className="text-base text-black leading-relaxed whitespace-pre-line">{result}</p>
            </div>
          )}

          {/* Result actions */}
          {!loading && (result || persona) && (
            <div className="flex items-center gap-5 mt-5">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors duration-150"
              >
                {copied ? (
                  <Check size={13} strokeWidth={1.5} />
                ) : (
                  <Copy size={13} strokeWidth={1.5} />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>

              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors duration-150"
              >
                {saved ? (
                  <Check size={13} strokeWidth={1.5} />
                ) : (
                  <Save size={13} strokeWidth={1.5} />
                )}
                {saved ? 'Saved' : 'Save'}
              </button>

              <button
                onClick={handleRegenerate}
                disabled={limitReached}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors duration-150 disabled:opacity-30"
              >
                <RefreshCw size={13} strokeWidth={1.5} />
                Regenerate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
