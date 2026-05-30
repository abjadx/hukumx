'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type SelectedCountry = {
  code: string;
  name: string;
  flag: string;
};

type SourceConfidence = 'high' | 'medium' | 'low';

type SelectedArticle = {
  articleNumber: string;
  sourceTitle: string;
  articleText: string;
};

type AnswerBoxProps = {
  answer: string;
  lawyerSummary: string;
  sourceNote?: string;
  sourceConfidence?: SourceConfidence;
  sourceTitle?: string;
  sourceArticles?: string[];
  primaryArticles?: string[];
  relatedArticles?: string[];
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
    return 'bg-green-500/20 text-green-300 border-green-500/50';
  }

  if (sourceConfidence === 'medium') {
    return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
  }

  if (sourceConfidence === 'low') {
    return 'bg-red-500/20 text-red-300 border-red-500/50';
  }

  return 'bg-slate-700 text-slate-300 border-slate-500';
}

function uniqueArticles(articles?: string[]) {
  if (!articles || articles.length === 0) return [];

  return Array.from(
    new Set(
      articles
        .map((article) => String(article).replace(/[^\d]/g, '').trim())
        .filter(Boolean)
    )
  );
}

function normalizeLegalReferencesForDisplay(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[（）]/g, (match) => (match === '（' ? '(' : ')'))

    // تحويل مراجع الفقرات والمواد المعطوبة قبل أي معالجة لترقيم بداية السطر:
    // 3() من المادة 123() / 3( ) من المادة 123( ) / 3( من المادة 123(
    // => الفقرة رقم 3 من المادة رقم 123
    .replace(
      /(\d+)\s*(?:\(\s*\)|\(\s*|\)\s*)\s+من\s+المادة\s+(\d+)\s*(?:\(\s*\)|\(\s*|\)\s*)?/g,
      'الفقرة رقم $1 من المادة رقم $2'
    )

    // 3() من المادة / 3( ) من المادة / 3( من المادة
    // => الفقرة رقم 3 من المادة
    .replace(
      /(\d+)\s*(?:\(\s*\)|\(\s*|\)\s*)\s+من\s+المادة/g,
      'الفقرة رقم $1 من المادة'
    )

    // أحكام المادة 170() / أحكام المادة 170( ) / أحكام المادة 170(
    // => أحكام المادة رقم 170
    .replace(
      /أحكام\s+المادة\s+(\d+)\s*(?:\(\s*\)|\(\s*|\)\s*)/g,
      'أحكام المادة رقم $1'
    )

    // المادة 170() / المادة 170( ) / المادة 170(
    // => المادة رقم 170
    .replace(
      /المادة\s+(\d+)\s*(?:\(\s*\)|\(\s*|\)\s*)/g,
      'المادة رقم $1'
    )

    // تحويل بداية السطر: 2) النص أو 2( النص أو 2( ) النص => 2. النص
    .replace(/^\s*(\d+)\s*(?:\(\s*\)|\(\s*|\)\s*)\s*/gm, '$1. ')

    // أي رقم متبقٍ بهذا الشكل 170() / 170( ) / 170(
    // => رقم 170
    .replace(/(\d+)\s*(?:\(\s*\)|\(\s*|\)\s*)/g, 'رقم $1')

    // بداية السطر: -1- النص / - 1- النص => 1. النص
    .replace(/^\s*-\s*(\d+)\s*[-–]\s*/gm, '$1. ')

    // بداية السطر: -1النص => 1. النص
    .replace(/^\s*-\s*(\d+)(?=[\u0600-\u06FF])/gm, '$1. ')

    // بداية السطر: 1النص => 1. النص
    .replace(/^\s*(\d+)(?=[\u0600-\u06FF])/gm, '$1. ')

    // رقم ملتصق بنص عربي داخل السطر
    .replace(/(\d+)(?=[\u0600-\u06FF])/g, '$1 ')

    // تنظيف المسافات والأسطر
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')

    // تحسين علامات الترقيم
    .replace(/\s+([،.:؛])/g, '$1')
    .replace(/([،.:؛])([^\s\n])/g, '$1 $2')
    .trim();
}

export default function AnswerBox({
  answer,
  lawyerSummary,
  sourceNote,
  sourceConfidence,
  sourceTitle,
  sourceArticles,
  primaryArticles,
  relatedArticles,
  loading,
  selectedCountry,
  hasAnyIntakeData,
  onEditDetails,
  onStartNewQuestion,
}: AnswerBoxProps) {
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [copiedLawyerSummary, setCopiedLawyerSummary] = useState(false);
  const [selectedArticle, setSelectedArticle] =
    useState<SelectedArticle | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState('');

  const cleanedPrimaryArticles = useMemo(
    () => uniqueArticles(primaryArticles),
    [primaryArticles]
  );
  const cleanedRelatedArticles = useMemo(
    () => uniqueArticles(relatedArticles),
    [relatedArticles]
  );
  const cleanedSourceArticles = useMemo(
    () => uniqueArticles(sourceArticles),
    [sourceArticles]
  );

  const answerSourceKey = useMemo(
    () =>
      [
        answer,
        lawyerSummary,
        sourceNote || '',
        sourceConfidence || '',
        sourceTitle || '',
        cleanedPrimaryArticles.join(','),
        cleanedRelatedArticles.join(','),
        cleanedSourceArticles.join(','),
      ].join('|'),
    [
      answer,
      lawyerSummary,
      sourceNote,
      sourceConfidence,
      sourceTitle,
      cleanedPrimaryArticles,
      cleanedRelatedArticles,
      cleanedSourceArticles,
    ]
  );

  const currentAnswerKeyRef = useRef(answerSourceKey);

  useEffect(() => {
    currentAnswerKeyRef.current = answerSourceKey;
    setSelectedArticle(null);
    setArticleError('');
    setArticleLoading(false);
  }, [answerSourceKey]);

  const hasSourceData =
    Boolean(sourceNote) ||
    Boolean(sourceConfidence) ||
    Boolean(sourceTitle) ||
    cleanedPrimaryArticles.length > 0 ||
    cleanedRelatedArticles.length > 0 ||
    cleanedSourceArticles.length > 0;

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

  const openArticleText = async (rawArticleNumber: string) => {
    const articleNumber = String(rawArticleNumber || '').replace(/[^\d]/g, '').trim();

    if (!articleNumber) {
      setArticleError('رقم المادة مطلوب.');
      return;
    }

    if (selectedArticle?.articleNumber === articleNumber && !articleLoading) {
      setSelectedArticle(null);
      setArticleError('');
      return;
    }

    const requestKey = currentAnswerKeyRef.current;

    try {
      setArticleLoading(true);
      setArticleError('');
      setSelectedArticle(null);

      const payload = {
        articleNumber,
        number: articleNumber,
        article: articleNumber,
        sourceTitle: String(sourceTitle || '').trim(),
        country: selectedCountry?.name,
      };

      const res = await fetch('/api/legal-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const textResponse = await res.text();

      if (currentAnswerKeyRef.current !== requestKey) {
        return;
      }

      let data: {
        error?: string;
        articleNumber?: string;
        sourceTitle?: string;
        articleText?: string;
        receivedBody?: unknown;
      } = {};

      try {
        data = JSON.parse(textResponse);
      } catch {
        console.error('Invalid legal article API response:', textResponse);
        setArticleError(`عاد الخادم برد غير صالح أثناء جلب نص المادة. كود الحالة: ${res.status}`);
        return;
      }

      if (!res.ok) {
        const debugBody = data.receivedBody
          ? ` | البيانات المرسلة: ${JSON.stringify(data.receivedBody)}`
          : '';
        setArticleError((data.error || `تعذر جلب نص المادة. كود الحالة: ${res.status}`) + debugBody);
        return;
      }

      if (currentAnswerKeyRef.current !== requestKey) {
        return;
      }

      setSelectedArticle({
        articleNumber: data.articleNumber || articleNumber,
        sourceTitle: data.sourceTitle || sourceTitle || 'مصدر قانوني معتمد',
        articleText: normalizeLegalReferencesForDisplay(data.articleText || ''),
      });
    } catch {
      if (currentAnswerKeyRef.current === requestKey) {
        setArticleError('تعذر الاتصال بالخادم لجلب نص المادة.');
      }
    } finally {
      if (currentAnswerKeyRef.current === requestKey) {
        setArticleLoading(false);
      }
    }
  };

  const renderArticleButtons = (
    articles: string[] | undefined,
    variant: 'primary' | 'related' | 'source'
  ) => {
    const cleanedArticles = uniqueArticles(articles);

    if (cleanedArticles.length === 0) return null;

    const buttonClass =
      variant === 'primary'
        ? 'rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer'
        : 'rounded-full border border-slate-400/60 bg-slate-700/50 px-3 py-1 text-xs font-bold text-slate-100 hover:bg-slate-600 transition-colors cursor-pointer';

    return (
      <div className="inline-flex flex-wrap gap-2">
        {cleanedArticles.map((article) => (
          <button
            key={`${variant}-${article}`}
            type="button"
            onClick={() => openArticleText(String(article))}
            className={buttonClass}
            title={`عرض أو إخفاء نص المادة ${article}`}
          >
            {selectedArticle?.articleNumber === article
              ? `إخفاء المادة ${article}`
              : `عرض المادة ${article}`}
          </button>
        ))}
      </div>
    );
  };

  const renderArticleText = (text: string) => {
  const cleanedText = text
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleanedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const normalizedLine = line
        // 3( ) من المادة 123( ) => الفقرة رقم 3 من المادة رقم 123
        .replace(
          /(\d+)\s*\(\s*\)\s+من\s+المادة\s+(\d+)\s*\(\s*\)/g,
          'الفقرة رقم $1 من المادة رقم $2'
        )

        // 3( ) من المادة 123 => الفقرة رقم 3 من المادة رقم 123
        .replace(
          /(\d+)\s*\(\s*\)\s+من\s+المادة\s+(\d+)/g,
          'الفقرة رقم $1 من المادة رقم $2'
        )

        // 3( من المادة 123( => الفقرة رقم 3 من المادة رقم 123
        .replace(
          /(\d+)\s*\(\s+من\s+المادة\s+(\d+)\s*\(/g,
          'الفقرة رقم $1 من المادة رقم $2'
        )

        // المادة 170( ) / المادة 170() / المادة 170( => المادة رقم 170
        .replace(/المادة\s+(\d+)\s*\(\s*\)/g, 'المادة رقم $1')
        .replace(/المادة\s+(\d+)\s*\(/g, 'المادة رقم $1')

        // 12() من هذا القانون => المادة رقم 12 من هذا القانون
        .replace(/(\d+)\s*\(\s*\)\s+من\s+هذا\s+القانون/g, 'المادة رقم $1 من هذا القانون')

        // 12( من هذا القانون => المادة رقم 12 من هذا القانون
        .replace(/(\d+)\s*\(\s+من\s+هذا\s+القانون/g, 'المادة رقم $1 من هذا القانون')

        // أي رقم متبقٍ بهذا الشكل 170( ) / 170() / 170( => رقم 170
        .replace(/(\d+)\s*\(\s*\)/g, 'رقم $1')
        .replace(/(\d+)\s*\(/g, 'رقم $1')
        .trim();

      // يلتقط:
      // 1. النص
      // 2) النص
      // 2( النص
      // (2) النص
      // (2 النص
      const numberedMatch = normalizedLine.match(
        /^\s*[\(\)]?\s*(\d+)\s*[\.\)\(،]?\s*(.+)$/
      );

      if (numberedMatch) {
        return (
          <div
            key={`${numberedMatch[1]}-${index}`}
            className="mb-4 flex items-start gap-3 text-right"
            dir="rtl"
          >
            <span className="mt-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-300">
              {numberedMatch[1]}
            </span>

            <p className="flex-1 text-base leading-9 text-slate-100">
              {numberedMatch[2]}
            </p>
          </div>
        );
      }

      return (
        <p
          key={`line-${index}`}
          className="mb-4 text-base leading-9 text-slate-100"
        >
          {normalizedLine}
        </p>
      );
    });
};

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

      {hasSourceData && (
        <div className="mt-5 rounded-2xl border border-slate-600 bg-slate-800/70 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">📚</span>
              <h4 className="text-amber-300 font-bold text-sm">
                المصدر القانوني المعتمد
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

          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-600 bg-slate-900/40 p-3 text-sm leading-7 text-slate-300">
              <span className="font-bold text-amber-300">تنبيه قانوني: </span>
              هذه الإجابة للاستدلال الأولي ولا تغني عن مراجعة محامٍ مختص لتطبيق النص على وقائع الحالة.
            </div>

            <div className="rounded-xl border border-slate-600 bg-slate-900/40 p-3 text-sm leading-7 text-slate-300">
              <span className="font-bold text-amber-300">ملاحظة تقنية: </span>
              عند إجراء بحث جديد يتم إغلاق أي مادة مفتوحة من البحث السابق تلقائيًا حتى لا تختلط المصادر.
            </div>
          </div>

          {(sourceTitle ||
            cleanedPrimaryArticles.length > 0 ||
            cleanedRelatedArticles.length > 0 ||
            cleanedSourceArticles.length > 0) && (
            <div className="mb-4 rounded-xl border border-slate-600 bg-slate-900/40 p-3">
              {sourceTitle && (
                <div className="mb-3 text-sm text-slate-200">
                  <span className="font-bold text-amber-300">
                    المصدر القانوني:{' '}
                  </span>
                  {sourceTitle}
                </div>
              )}

              {cleanedPrimaryArticles.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                  <span className="font-bold text-amber-300">
                    المادة الأساسية:
                  </span>
                  {renderArticleButtons(cleanedPrimaryArticles, 'primary')}
                </div>
              )}

              {cleanedRelatedArticles.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                  <span className="font-bold text-amber-300">
                    مواد مرتبطة:
                  </span>
                  {renderArticleButtons(cleanedRelatedArticles, 'related')}
                </div>
              )}

              {cleanedPrimaryArticles.length === 0 &&
                cleanedRelatedArticles.length === 0 &&
                cleanedSourceArticles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                    <span className="font-bold text-amber-300">
                      المواد ذات العلاقة:
                    </span>
                    {renderArticleButtons(cleanedSourceArticles, 'source')}
                  </div>
                )}
            </div>
          )}

          {articleLoading && (
            <div className="mt-4 rounded-xl border border-slate-600 bg-slate-900/50 p-4 text-sm text-slate-300">
              جاري جلب نص المادة...
            </div>
          )}

          {articleError && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              {articleError}
            </div>
          )}

          {selectedArticle && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-slate-900/70 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="text-right">
                  <h5 className="text-base font-bold text-amber-300">
                    المادة {selectedArticle.articleNumber}
                  </h5>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedArticle.sourceTitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="rounded-lg border border-slate-500 bg-slate-700 px-4 py-2 text-xs font-bold text-slate-100 hover:bg-slate-600 transition-colors"
                >
                  إغلاق
                </button>
              </div>

              <div
                className="rounded-xl bg-slate-950/60 p-5 text-right"
                dir="rtl"
                style={{ color: '#f8fafc' }}
              >
                {renderArticleText(selectedArticle.articleText)}
              </div>
            </div>
          )}

          {sourceNote && (
            <div className="mt-4 rounded-xl border border-slate-600 bg-slate-900/40 p-3 text-sm leading-7 text-slate-300">
              <span className="font-bold text-amber-300">ملاحظة المصدر: </span>
              {sourceNote}
            </div>
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
