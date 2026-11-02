import { useState, useCallback } from 'react';
import { Sparkles, Lightbulb, Smile, PenLine } from 'lucide-react';
import type { GeneratorType } from '../types';

const GENERATORS: Record<
  GeneratorType,
  { label: string; icon: typeof Sparkles; description: string }
> = {
  advice: {
    label: 'Advice Slips',
    icon: Lightbulb,
    description: 'Wise, practical nuggets to spark your next post.',
  },
  persona: {
    label: 'Profile Personas',
    icon: Sparkles,
    description: 'Detailed creator personas with tone, style, and best-for.',
  },
  joke: {
    label: 'Dad Jokes',
    icon: Smile,
    description: 'Groan-worthy one-liners to lighten your content.',
  },
  custom: {
    label: 'Custom',
    icon: PenLine,
    description: 'Write your own prompt.',
  },
};

interface HomeViewProps {
  onNavigate: (type: GeneratorType) => void;
}

export default function HomeView({ onNavigate }: HomeViewProps) {
  const [hovered, setHovered] = useState<GeneratorType | null>(null);

  const handleClick = useCallback(
    (type: GeneratorType) => () => onNavigate(type),
    [onNavigate]
  );

  const handleEnter = useCallback(
    (type: GeneratorType) => () => setHovered(type),
    []
  );
  const handleLeave = useCallback(() => setHovered(null), []);

  return (
    <div className="px-4 sm:px-8">
      <div className="max-w-2xl mx-auto text-center pt-16 sm:pt-24 pb-14">
        <p className="text-xs tracking-[0.2em] uppercase text-gray-400 mb-4">
          SparkMeme
        </p>
        <h1 className="text-2xl sm:text-3xl font-medium leading-snug text-black">
          Inspiration for content creators
        </h1>
        <p className="mt-4 text-sm sm:text-base text-gray-500 leading-relaxed max-w-md mx-auto">
          Generate advice slips, profile personas, and dad jokes to break
          through creative block.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="grid gap-px bg-gray-200 border border-gray-200 rounded-md overflow-hidden">
          {(Object.keys(GENERATORS) as GeneratorType[]).map((type) => {
            const gen = GENERATORS[type];
            const Icon = gen.icon;
            const isHovered = hovered === type;

            return (
              <button
                key={type}
                onClick={handleClick(type)}
                onMouseEnter={handleEnter(type)}
                onMouseLeave={handleLeave}
                className={`flex items-center gap-4 px-6 py-6 text-left bg-white transition-colors duration-150 ${
                  isHovered ? 'bg-gray-50' : ''
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  className="text-black flex-shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-black">
                    {gen.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {gen.description}
                  </div>
                </div>
                <span
                  className={`ml-auto text-xs transition-opacity duration-150 ${
                    isHovered ? 'opacity-100 text-black' : 'opacity-0'
                  }`}
                >
                  Generate →
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
