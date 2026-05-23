'use client';

type SuggestedQuestionsProps = {
  suggestions: string[];
  loading: boolean;
  onAskSuggestion: (question: string) => void;
};

export default function SuggestedQuestions({
  suggestions,
  loading,
  onAskSuggestion,
}: SuggestedQuestionsProps) {
  if (suggestions.length === 0 || loading) return null;

  return (
    <div className="w-full max-w-2xl mt-4" dir="rtl">
      <p className="text-slate-400 text-sm mb-3">
        🤔 أسئلة مقترحة بناءً على استشارتك:
      </p>

      <div className="flex flex-col gap-2">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onAskSuggestion(s)}
            className="bg-slate-700 hover:bg-amber-500 hover:text-black text-slate-300 text-sm px-4 py-3 rounded-xl border border-slate-600 hover:border-amber-400 transition-all text-right"
          >
            {s} ←
          </button>
        ))}
      </div>
    </div>
  );
}