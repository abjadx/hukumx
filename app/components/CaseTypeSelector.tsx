'use client';

import { CASE_TYPES } from '../data/legal-options';

type CaseTypeSelectorProps = {
  caseType: string;
  formError: string;
  onSelect: (caseTypeCode: string) => void;
};

export default function CaseTypeSelector({
  caseType,
  formError,
  onSelect,
}: CaseTypeSelectorProps) {
  return (
    <div
      className={`bg-slate-700 rounded-2xl p-4 border-2 transition-all ${
        !caseType && formError.includes('القضية')
          ? 'border-red-400'
          : 'border-transparent'
      }`}
      dir="rtl"
    >
      <p className="text-slate-300 text-sm mb-3 font-medium">
        <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full ml-2">
          2
        </span>
        نوع القضية
      </p>

      <div className="flex flex-wrap gap-2">
        {CASE_TYPES.map((c) => (
          <button
            key={c.code}
            onClick={() => onSelect(c.code)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              caseType === c.code
                ? 'bg-amber-500 text-black border-amber-500'
                : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400 hover:text-white'
            }`}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}