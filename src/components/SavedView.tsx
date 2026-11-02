import { Trash2 } from 'lucide-react';
import type { SavedItem, GeneratorType } from '../types';

const TYPE_LABELS: Record<GeneratorType, string> = {
  advice: 'Advice Slip',
  persona: 'Profile Persona',
  joke: 'Dad Joke',
  custom: 'Custom',
};

interface SavedViewProps {
  items: SavedItem[];
  onRemove: (id: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SavedView({ items, onRemove }: SavedViewProps) {
  if (items.length === 0) {
    return (
      <div className="px-4 sm:px-8">
        <div className="max-w-2xl mx-auto pt-8 sm:pt-12">
          <h2 className="text-xl font-medium text-black mb-8">Saved</h2>
          <div className="border border-dashed border-gray-200 rounded p-10 text-center">
            <p className="text-sm text-gray-400">
              No saved items yet. Generate something and save it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8">
      <div className="max-w-2xl mx-auto pt-8 sm:pt-12">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="text-xl font-medium text-black">Saved</h2>
          <span className="text-xs text-gray-400">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <ul className="space-y-px">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-start gap-4 border border-gray-200 rounded p-5 bg-white mb-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-medium text-black">
                    {TYPE_LABELS[item.type]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {item.text}
                </p>
              </div>
              <button
                onClick={() => onRemove(item.id)}
                className="flex-shrink-0 text-gray-300 hover:text-black transition-colors duration-150 opacity-0 group-hover:opacity-100"
                title="Remove"
              >
                <Trash2 size={15} strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
