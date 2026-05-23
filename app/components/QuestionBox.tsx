'use client';

type SelectedCountry = {
  code: string;
  name: string;
  flag: string;
};

type SelectedCaseType = {
  code: string;
  name: string;
  icon: string;
};

type QuestionBoxProps = {
  question: string;
  loading: boolean;
  selectedCountry?: SelectedCountry;
  selectedCaseType?: SelectedCaseType;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
};

export default function QuestionBox({
  question,
  loading,
  selectedCountry,
  selectedCaseType,
  onQuestionChange,
  onAsk,
}: QuestionBoxProps) {
  return (
    <div className="bg-slate-700 rounded-2xl p-4" dir="rtl">
      <p className="text-slate-300 text-sm mb-3 font-medium">
        <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full ml-2">
          3
        </span>
        اكتب سؤالك القانوني
      </p>

      <div className="flex gap-3">
        <input
          type="text"
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAsk()}
          placeholder="مثال: عندي عقد شراكة وفي خلاف على الأرباح، ماذا أفعل؟"
          className="flex-1 bg-slate-600 text-white placeholder-slate-400 outline-none text-right text-base px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 transition-all"
          dir="rtl"
        />

        <button
          onClick={onAsk}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold px-6 py-3 rounded-xl transition-all whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              جاري...
            </span>
          ) : (
            'اسأل ⚖️'
          )}
        </button>
      </div>

      {(selectedCountry || selectedCaseType) && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {selectedCountry && (
            <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
              {selectedCountry.flag} {selectedCountry.name}
            </span>
          )}

          {selectedCaseType && (
            <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
              {selectedCaseType.icon} {selectedCaseType.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}