'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

type SelectedCountry = {
  code: string;
  name: string;
  flag: string;
};

type SourceConfidence = 'high' | 'medium' | 'low';

type AnswerBoxProps = {
  answer: string;
  lawyerSummary: string;
  sourceNote?: string;
  sourceConfidence?: SourceConfidence;
  loading: boolean;
  selectedCountry?: SelectedCountry;
  hasAnyIntakeData: string | boolean;
  onEditDetails: () => void;
  onStartNewQuestion: () => void;
};

function getSourceConfidenceLabel(sourceConfidence?: SourceConfidence) {
  if (sourceConfidence === 'high') return 'عالية';
  if (sourceConfidence === 'medium') return 'متوسطة';
  if (sourceConfidence === 'low') return 'منخفضة';
  return '';
}

function getSourceConfidenceClass(sourceConfidence?: SourceConfidence) {
  if (sourceConfidence === 'high') {
    return 'bg-green-500/15 text-green-300 border-green-500/40';
  }

  if (sourceConfidence === 'medium') {
    return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40';
  }

  if (sourceConfidence === 'low') {
    return 'bg-red-500/15 text-red-300 border-red-500/40';
  }

  return 'bg-slate-600 text-slate-300 border-slate-500';
}

export default function AnswerBox({
  answer,
  lawyerSummary,
  sourceNote,
  sourceConfidence,
  loading,
  selectedCountry,
  hasAnyIntakeData,
  onEditDetails,
  onStartNewQuestion,
}: AnswerBoxProps) {
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [copiedLawyerSummary, setCopiedLawyerSummary] = useState(false);

  if (!answer || loading) return null;

  const copyLawyerSummary = async () => {
    if (!lawyerSummary) return;

    await navigator.clipboard.writeText(lawyerSummary);
    setCopiedLawyerSummary(true);

    setTimeout(() => {
      setCopiedLawyerSummary(false);
    }, 2000);
  };

  const copyAnswer = async () => {
    await navigator.clipboard.writeText(answer);
    setCopiedAnswer(true);

    setTimeout(() => {
      setCopiedAnswer(false);
    }, 2000);
  };

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

      {(sourceNote || sourceConfidence) && (
        <div className="mt-5 rounded-2xl border border-slate-600 bg-slate-800/70 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">📚</span>
              <h4 className="text-amber-300 font-bold text-sm">
                قوة المصدر القانوني
              </h4>
            </div>

            {sourceConfidence && (
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full border ${getSourceConfidenceClass(
                  sourceConfidence
                )}`}
              >
                درجة الثقة: {getSourceConfidenceLabel(sourceConfidence)}
              </span>
            )}
          </div>

          {sourceNote && (
            <p className="text-slate-300 text-sm leading-7">
              {sourceNote}
            </p>
          )}
        </div>
      )}

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

            {lawyerSummary && (
              <button
                onClick={copyLawyerSummary}
                className={`border text-sm px-4 py-2 rounded-xl transition-colors ${
                  copiedLawyerSummary
                    ? 'bg-green-500/20 text-green-300 border-green-500/40'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                }`}
              >
                {copiedLawyerSummary
                  ? 'تم نسخ الملخص ✅'
                  : 'نسخ ملخص المحامي 👨‍⚖️'}
              </button>
            )}

            <button
              onClick={copyAnswer}
              className={`text-sm px-4 py-2 rounded-xl transition-colors ${
                copiedAnswer
                  ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
              }`}
            >
              {copiedAnswer ? 'تم النسخ ✅' : 'نسخ 📋'}
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