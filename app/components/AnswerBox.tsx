'use client';

import ReactMarkdown from 'react-markdown';

type SelectedCountry = {
  code: string;
  name: string;
  flag: string;
};

type AnswerBoxProps = {
  answer: string;
  loading: boolean;
  selectedCountry?: SelectedCountry;
  hasAnyIntakeData: string | boolean;
  onEditDetails: () => void;
  onStartNewQuestion: () => void;
};

export default function AnswerBox({
  answer,
  loading,
  selectedCountry,
  hasAnyIntakeData,
  onEditDetails,
  onStartNewQuestion,
}: AnswerBoxProps) {
  if (!answer || loading) return null;

  return (
    <div
      className="w-full max-w-2xl mt-6 bg-slate-700 rounded-2xl p-6 shadow-xl border border-slate-600"
      dir="rtl"
    >
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-600">
        <span className="text-amber-400 text-xl">⚖️</span>
        <h3 className="text-amber-400 font-bold text-lg">
          الاستشارة القانونية
        </h3>

        {selectedCountry && (
          <span className="mr-auto text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded-full">
            {selectedCountry.flag} {selectedCountry.name}
          </span>
        )}
      </div>

      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-amber-400 mt-4 mb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-amber-300 mt-4 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-bold text-amber-200 mt-3 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-slate-200 mb-3 leading-relaxed">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="text-white font-bold">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-2 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-slate-200">{children}</li>,
          hr: () => <hr className="border-slate-600 my-4" />,
          blockquote: ({ children }) => (
            <blockquote className="border-r-4 border-amber-400 pr-4 my-3 text-slate-300 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-slate-600 text-amber-300 px-3 py-2 border border-slate-500 text-right">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="text-slate-200 px-3 py-2 border border-slate-600">
              {children}
            </td>
          ),
        }}
      >
        {answer}
      </ReactMarkdown>

      <div className="mt-6 pt-4 border-t border-slate-600 space-y-3">
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <span className="text-slate-400 text-sm">
            ⚠️ استشارة أولية — استشر محاميًا متخصصًا
          </span>

          <div className="flex gap-2 flex-wrap">
            {hasAnyIntakeData && (
              <button
                onClick={onEditDetails}
                className="bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm px-4 py-2 rounded-xl transition-colors"
              >
                تعديل التفاصيل ✏️
              </button>
            )}

            <button
              onClick={() => navigator.clipboard.writeText(answer)}
              className="bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm px-4 py-2 rounded-xl transition-colors"
            >
              نسخ 📋
            </button>

            <button
              onClick={onStartNewQuestion}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm px-4 py-2 rounded-xl transition-colors"
            >
              سؤال جديد +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}