'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

const COUNTRIES = [
  { code: 'JO', name: 'الأردن', flag: '🇯🇴' },
  { code: 'SA', name: 'السعودية', flag: '🇸🇦' },
  { code: 'AE', name: 'الإمارات', flag: '🇦🇪' },
  { code: 'EG', name: 'مصر', flag: '🇪🇬' },
  { code: 'IQ', name: 'العراق', flag: '🇮🇶' },
  { code: 'OTHER', name: 'دولة أخرى', flag: '🌍' },
];

const CASE_TYPES = [
  { code: 'work', name: 'عمل وموظفين', icon: '💼' },
  { code: 'rent', name: 'إيجارات وعقارات', icon: '🏠' },
  { code: 'company', name: 'شركات وعقود', icon: '🏢' },
  { code: 'family', name: 'أحوال شخصية', icon: '👨‍👩‍👧' },
  { code: 'financial', name: 'مطالبات مالية', icon: '💰' },
  { code: 'criminal', name: 'قضايا جزائية', icon: '⚖️' },
  { code: 'digital', name: 'جرائم إلكترونية', icon: '💻' },
  { code: 'ip', name: 'ملكية فكرية', icon: '📋' },
  { code: 'other', name: 'أخرى', icon: '❓' },
];

type IntakeData = {
  verdictType: string;
  appearanceType: string;
  notificationStatus: string;
  notificationDate: string;
  court: string;
  role: string;
  details: string;
};

const EMPTY_INTAKE: IntakeData = {
  verdictType: '',
  appearanceType: '',
  notificationStatus: '',
  notificationDate: '',
  court: '',
  role: '',
  details: '',
};

export default function Home() {
  const [country, setCountry] = useState('');
  const [caseType, setCaseType] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [showIntake, setShowIntake] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [intakeData, setIntakeData] = useState<IntakeData>(EMPTY_INTAKE);

  const selectedCountry = COUNTRIES.find((c) => c.code === country);
  const selectedCaseType = CASE_TYPES.find((c) => c.code === caseType);

  const hasIntakeData =
    intakeData.verdictType ||
    intakeData.appearanceType ||
    intakeData.notificationStatus ||
    intakeData.notificationDate ||
    intakeData.court ||
    intakeData.role ||
    intakeData.details;

  const startNewQuestion = () => {
    setCountry('');
    setCaseType('');
    setQuestion('');
    setAnswer('');
    setSuggestions([]);
    setLoading(false);
    setFormError('');
    setShowIntake(false);
    setPendingQuestion('');
    setIntakeData(EMPTY_INTAKE);
  };

  const editIntakeDetails = () => {
    setAnswer('');
    setSuggestions([]);
    setShowIntake(true);

    if (!pendingQuestion && question) {
      setPendingQuestion(question);
    }
  };

  const askQuestion = async (q?: string, intake?: IntakeData) => {
    const finalQuestion = q || question;

    if (!finalQuestion.trim()) {
      setFormError('يرجى كتابة سؤالك القانوني أولًا');
      return;
    }

    setFormError('');

    if (!country) {
      setFormError('يرجى اختيار الدولة أولًا 👆');
      return;
    }

    if (!caseType) {
      setFormError('يرجى اختيار نوع القضية أولًا 👆');
      return;
    }

    setLoading(true);
    setAnswer('');
    setSuggestions([]);
    setShowIntake(false);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: finalQuestion,
          country: selectedCountry?.name || 'غير محدد',
          caseType: selectedCaseType?.name || 'غير محدد',
          intakeData: intake || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAnswer(`> ⚠️ **${data.error || 'حدث خطأ'}**`);
        return;
      }

      if (data.needsIntake) {
        setPendingQuestion(finalQuestion);
        setIntakeData(EMPTY_INTAKE);
        setShowIntake(true);
        return;
      }

      setQuestion(finalQuestion);
      setAnswer(data.answer || '');
      setSuggestions(data.suggestions || []);
    } catch {
      setAnswer('> ⚠️ **تعذّر الاتصال بالخادم، تحقق من اتصالك بالإنترنت**');
    } finally {
      setLoading(false);
    }
  };

  const submitIntake = () => {
    if (
      !intakeData.verdictType ||
      !intakeData.appearanceType ||
      !intakeData.notificationStatus ||
      !intakeData.court ||
      !intakeData.role
    ) {
      setFormError('يرجى تعبئة الحقول المطلوبة في نموذج الحكم أو الاستئناف');
      return;
    }

    setFormError('');
    askQuestion(pendingQuestion, intakeData);
  };

  const cancelIntake = () => {
    setShowIntake(false);
    setPendingQuestion('');
    setIntakeData(EMPTY_INTAKE);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-4 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-white">
          ⚖️ Hukumx <span className="text-amber-400">حكمx</span>
        </h1>

        <div className="flex gap-4">
          <button className="text-slate-300 hover:text-white px-4 py-2">
            تسجيل دخول
          </button>
          <button className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2 rounded-lg">
            ابدأ مجانًا
          </button>
        </div>
      </nav>

      <div className="flex flex-col items-center px-4 py-12">
        {/* Hero */}
        <h2 className="text-5xl font-bold text-white mb-4 text-center">
          Hukumx
          <br />
          <span className="text-amber-400">مساعدك القانوني الذكي</span>
        </h2>

        <p className="text-slate-300 text-xl mb-10 text-center max-w-2xl">
          افهم موقفك القانوني، صنّف حالتك، واعرف الخطوات المناسبة قبل التواصل
          مع محامٍ مختص.
        </p>

        <div className="w-full max-w-2xl space-y-4">
          {/* Step 1 - Country */}
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
                  onClick={() => {
                    setCountry(c.code);
                    setFormError('');
                  }}
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

          {/* Step 2 - Case Type */}
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
                  onClick={() => {
                    setCaseType(c.code);
                    setFormError('');
                  }}
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

          {/* Step 3 - Question */}
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
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                placeholder="مثال: كم مدة الاستئناف بعد صدور حكم في قضية شيك؟"
                className="flex-1 bg-slate-600 text-white placeholder-slate-400 outline-none text-right text-base px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 transition-all"
                dir="rtl"
              />

              <button
                onClick={() => askQuestion()}
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

            {/* Selected filters */}
            {(country || caseType) && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {country && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
                    {selectedCountry?.flag} {selectedCountry?.name}
                  </span>
                )}

                {caseType && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
                    {selectedCaseType?.icon} {selectedCaseType?.name}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Form Error */}
          {formError && (
            <div dir="rtl">
              <p className="text-red-400 text-sm text-right bg-red-400/10 border border-red-400/30 px-4 py-3 rounded-xl">
                ⚠️ {formError}
              </p>
            </div>
          )}
        </div>

        {/* Case Intake Form */}
        {showIntake && !loading && (
          <div
            className="w-full max-w-2xl mt-6 bg-slate-700 rounded-2xl p-6 border border-amber-500/50 shadow-xl"
            dir="rtl"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-600">
              <span className="text-amber-400 text-xl">📋</span>
              <h3 className="text-amber-400 font-bold text-lg">
                تفاصيل الاستئناف / الحكم
              </h3>
            </div>

            <p className="text-slate-300 text-sm mb-5 leading-relaxed">
              لأن سؤالك مرتبط بحكم أو مدة قانونية، نحتاج بعض التفاصيل قبل
              تقديم توجيه أدق. لا تكتب معلومات شخصية حساسة.
            </p>

            {pendingQuestion && (
              <div className="mb-5 bg-slate-800/60 border border-slate-600 rounded-xl p-4">
                <p className="text-slate-400 text-xs mb-1">السؤال:</p>
                <p className="text-slate-200 text-sm">{pendingQuestion}</p>
              </div>
            )}

            <div className="space-y-5">
              {/* نوع الحكم */}
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  نوع الحكم أو القرار <span className="text-red-400">*</span>
                </label>

                <div className="flex flex-wrap gap-2">
                  {[
                    'حكم ابتدائي',
                    'حكم استئناف',
                    'حكم تمييز',
                    'أمر قضائي',
                    'حكم تحكيم',
                    'لا أعرف',
                  ].map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setIntakeData((p) => ({ ...p, verdictType: type }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        intakeData.verdictType === type
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* طريقة صدور الحكم */}
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  طريقة صدور الحكم <span className="text-red-400">*</span>
                </label>

                <div className="flex flex-wrap gap-2">
                  {['وجاهي', 'غيابي', 'بمثابة الوجاهي', 'لا أعرف'].map(
                    (type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setIntakeData((p) => ({
                            ...p,
                            appearanceType: type,
                          }))
                        }
                        className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                          intakeData.appearanceType === type
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                        }`}
                      >
                        {type}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* حالة التبليغ */}
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل تم تبليغك بالحكم رسميًا؟{' '}
                  <span className="text-red-400">*</span>
                </label>

                <div className="flex flex-wrap gap-2">
                  {['نعم، تم تبليغي', 'لا، لم يتم تبليغي', 'لا أعرف'].map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() =>
                          setIntakeData((p) => ({
                            ...p,
                            notificationStatus: status,
                          }))
                        }
                        className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                          intakeData.notificationStatus === status
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                        }`}
                      >
                        {status}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* تاريخ التبليغ */}
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  تاريخ التبليغ أو تاريخ الحكم{' '}
                  <span className="text-slate-500">(اختياري)</span>
                </label>

                <input
                  type="date"
                  value={intakeData.notificationDate}
                  onChange={(e) =>
                    setIntakeData((p) => ({
                      ...p,
                      notificationDate: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-600 text-white px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all"
                />
                {intakeData.notificationStatus === 'نعم، تم تبليغي' &&
                  !intakeData.notificationDate && (
                    <p className="mt-2 text-amber-300 text-sm bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 leading-relaxed">
                      ⚠️ تاريخ التبليغ مهم جدًا لحساب مدة الطعن. أدخله إن كان متوفرًا.
                    </p>
                  )}
              </div>

              {/* المحكمة */}
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  المحكمة أو الجهة التي أصدرت الحكم{' '}
                  <span className="text-red-400">*</span>
                </label>

                <input
                  type="text"
                  value={intakeData.court}
                  onChange={(e) =>
                    setIntakeData((p) => ({ ...p, court: e.target.value }))
                  }
                  placeholder="مثال: محكمة بداية عمان، محكمة صلح إربد، لا أعرف..."
                  className="w-full bg-slate-600 text-white placeholder-slate-400 px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all text-right"
                />
              </div>

              {/* الصفة */}
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  صفتك في القضية <span className="text-red-400">*</span>
                </label>

                <div className="flex flex-wrap gap-2">
                  {[
                    'مدعي',
                    'مدعى عليه',
                    'محكوم عليه',
                    'محكوم له',
                    'مشتكي',
                    'مشتكى عليه',
                    'طرف ثالث',
                    'لا أعرف',
                  ].map((role) => (
                    <button
                      key={role}
                      onClick={() =>
                        setIntakeData((p) => ({ ...p, role }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        intakeData.role === role
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* تفاصيل إضافية */}
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  تفاصيل إضافية{' '}
                  <span className="text-slate-500">(اختياري)</span>
                </label>

                <textarea
                  value={intakeData.details}
                  onChange={(e) =>
                    setIntakeData((p) => ({ ...p, details: e.target.value }))
                  }
                  placeholder="أي معلومات إضافية تساعد في تقديم توجيه أدق، بدون ذكر معلومات شخصية حساسة..."
                  rows={3}
                  className="w-full bg-slate-600 text-white placeholder-slate-400 px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all text-right resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={submitIntake}
                  disabled={
                    !intakeData.verdictType ||
                    !intakeData.appearanceType ||
                    !intakeData.notificationStatus ||
                    !intakeData.court ||
                    !intakeData.role
                  }
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all"
                >
                  احصل على الاستشارة ⚖️
                </button>

                <button
                  onClick={cancelIntake}
                  className="px-6 bg-slate-600 hover:bg-slate-500 text-slate-300 py-3 rounded-xl transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="w-full max-w-2xl mt-6 bg-slate-700 rounded-2xl p-6 animate-pulse">
            <div className="h-4 bg-slate-600 rounded w-3/4 ml-auto mb-3" />
            <div className="h-4 bg-slate-600 rounded w-full mb-3" />
            <div className="h-4 bg-slate-600 rounded w-5/6 ml-auto mb-3" />
            <div className="h-4 bg-slate-600 rounded w-4/5 ml-auto" />
          </div>
        )}

       {/* Answer Box */}
{answer && !loading && (
  <div
    className="w-full max-w-2xl mt-6 bg-slate-700 rounded-2xl p-6 shadow-xl border border-slate-600"
    dir="rtl"
  >
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-600">
      <span className="text-amber-400 text-xl">⚖️</span>
      <h3 className="text-amber-400 font-bold text-lg">
        الاستشارة القانونية
      </h3>

      {country && (
        <span className="mr-auto text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded-full">
          {selectedCountry?.flag} {selectedCountry?.name}
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
          <p className="text-slate-200 mb-3 leading-relaxed">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="text-white font-bold">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside my-2 space-y-1">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside my-2 space-y-1">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-slate-200">{children}</li>
        ),
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
          {hasIntakeData && (
            <button
              onClick={editIntakeDetails}
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
            onClick={startNewQuestion}
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm px-4 py-2 rounded-xl transition-colors"
          >
            سؤال جديد +
          </button>
        </div>
      </div>
    </div>
  </div>
)}
        {/* Suggested Questions */}
        {suggestions.length > 0 && !loading && (
          <div className="w-full max-w-2xl mt-4" dir="rtl">
            <p className="text-slate-400 text-sm mb-3">
              🤔 أسئلة مقترحة بناءً على استشارتك:
            </p>

            <div className="flex flex-col gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => askQuestion(s)}
                  className="bg-slate-700 hover:bg-amber-500 hover:text-black text-slate-300 text-sm px-4 py-3 rounded-xl border border-slate-600 hover:border-amber-400 transition-all text-right"
                >
                  {s} ←
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}