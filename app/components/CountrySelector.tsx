'use client';

import { COUNTRIES } from '../data/legal-options';

type CountrySelectorProps = {
  country: string;
  formError: string;
  onSelect: (countryCode: string) => void;
};

export default function CountrySelector({
  country,
  formError,
  onSelect,
}: CountrySelectorProps) {
  return (
    <div
      className={`bg-slate-700 rounded-2xl p-4 border-2 transition-all ${
        !country && formError.includes('الدولة')
          ? 'border-red-400'
          : 'border-transparent'
      }`}
      dir="rtl"
    >
      <p className="text-slate-300 text-sm mb-3 font-medium">
        <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full ml-2">
          1
        </span>
        اختر الدولة
      </p>

      <div className="flex flex-wrap gap-2">
        {COUNTRIES.map((c) => (
          <button
            key={c.code}
            onClick={() => onSelect(c.code)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              country === c.code
                ? 'bg-amber-500 text-black border-amber-500'
                : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400 hover:text-white'
            }`}
          >
            {c.flag} {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}