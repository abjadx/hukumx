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

export default function Home() {
  const [country, setCountry] = useState('');
  const [caseType, setCaseType] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const askQuestion = async (q?: string) => {
    const finalQuestion = q || question;
    if (!finalQuestion.trim()) return;

    setFormError('');

    if (!country) {
      setFormError('يرجى اختيار الدولة أولاً 👆');
      return;
    }

    if (!caseType) {
      setFormError('يرجى اختيار نوع القضية أولاً 👆');
      return;
    }

    setQuestion(finalQuestion);
    setLoading(true);
    setAnswer('');
    setSuggestions([]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: finalQuestion,
          country: COUNTRIES.find(c => c.code === country)?.name || 'غير محدد',
          caseType: CASE_TYPES.find(c => c.code === caseType)?.name || 'غير محدد',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAnswer(`> ⚠️ **${data.error || 'حدث خطأ'}**`);
        return;
      }

      setAnswer(data.answer);
      setSuggestions(data.suggestions || []);
    } catch {
      setAnswer('> ⚠️ **تعذّر الاتصال بالخادم، تحقق من اتصالك بالإنترنت**');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">

      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-4 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-white">⚖️ Hukumx <span className="text-amber-400">حكمx</span></h1>
        <div className="flex gap-4">
          <button className="text-slate-300 hover:text-white px-4 py-2">تسجيل دخول</button>
          <button className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2 rounded-lg">ابدأ مجاناً</button>
        </div>
      </nav>

      <div className="flex flex-col items-center px-4 py-12">
        <h2 className="text-5xl font-bold text-white mb-4 text-center">
          Hukumx<br/>
          <span className="text-amber-400">مساعدك القانوني الذكي</span>
        </h2>

        <p className="text-slate-300 text-xl mb-10 text-center max-w-2xl">
           افهم موقفك القانوني، صنّف حالتك، واعرف الخطوات المناسبة قبل التواصل مع محامٍ مختص.
        </p>

        <div className="w-full max-w-2xl space-y-4">

          {/* Step 1 - Country */}
          <div className={`bg-slate-700 rounded-2xl p-4 border-2 transition-all ${!country && formError.includes('الدولة') ? 'border-red-400' : 'border-transparent'}`} dir="rtl">
            <p className="text-slate-300 text-sm mb-3 font-medium">
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full ml-2">1</span>
              اختر الدولة
            </p>
            <div className="flex flex-wrap gap-2">
              {COUNTRIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setCountry(c.code); setFormError(''); }}
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
          <div className={`bg-slate-700 rounded-2xl p-4 border-2 transition-all ${!caseType && formError.includes('القضية') ? 'border-red-400' : 'border-transparent'}`} dir="rtl">
            <p className="text-slate-300 text-sm mb-3 font-medium">
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full ml-2">2</span>
              نوع القضية
            </p>
            <div className="flex flex-wrap gap-2">
              {CASE_TYPES.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setCaseType(c.code); setFormError(''); }}
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
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full ml-2">3</span>
              اكتب سؤالك القانوني
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                placeholder="مثال: ما هي حقوقي إذا فُصلت من العمل بدون سبب؟"
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
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    جاري...
                  </span>
                ) : 'اسأل ⚖️'}
              </button>
            </div>

            {/* Selected filters display */}
            {(country || caseType) && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {country && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
                    {COUNTRIES.find(c => c.code === country)?.flag} {COUNTRIES.find(c => c.code === country)?.name}
                  </span>
                )}
                {caseType && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
                    {CASE_TYPES.find(c => c.code === caseType)?.icon} {CASE_TYPES.find(c => c.code === caseType)?.name}
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

        {/* Loading Skeleton */}
        {loading && (
          <div className="w-full max-w-2xl mt-6 bg-slate-700 rounded-2xl p-6 animate-pulse">
            <div className="h-4 bg-slate-600 rounded w-3/4 ml-auto mb-3"/>
            <div className="h-4 bg-slate-600 rounded w-full mb-3"/>
            <div className="h-4 bg-slate-600 rounded w-5/6 ml-auto mb-3"/>
            <div className="h-4 bg-slate-600 rounded w-4/5 ml-auto"/>
          </div>
        )}

        {/* Answer Box */}
        {answer && !loading && (
          <div className="w-full max-w-2xl mt-6 bg-slate-700 rounded-2xl p-6 shadow-xl border border-slate-600" dir="rtl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-600">
              <span className="text-amber-400 text-xl">⚖️</span>
              <h3 className="text-amber-400 font-bold text-lg">الاستشارة القانونية</h3>
              {country && (
                <span className="mr-auto text-xs bg-slate-600 text-slate-300 px-2 py-1 rounded-full">
                  {COUNTRIES.find(c => c.code === country)?.flag} {COUNTRIES.find(c => c.code === country)?.name}
                </span>
              )}
            </div>

            <ReactMarkdown
              components={{
                h1: ({children}) => <h1 className="text-2xl font-bold text-amber-400 mt-4 mb-2">{children}</h1>,
                h2: ({children}) => <h2 className="text-xl font-bold text-amber-300 mt-4 mb-2">{children}</h2>,
                h3: ({children}) => <h3 className="text-lg font-bold text-amber-200 mt-3 mb-1">{children}</h3>,
                p: ({children}) => <p className="text-slate-200 mb-3 leading-relaxed">{children}</p>,
                strong: ({children}) => <strong className="text-white font-bold">{children}</strong>,
                ul: ({children}) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
                li: ({children}) => <li className="text-slate-200">{children}</li>,
                hr: () => <hr className="border-slate-600 my-4"/>,
                blockquote: ({children}) => <blockquote className="border-r-4 border-amber-400 pr-4 my-3 text-slate-300 italic">{children}</blockquote>,
                table: ({children}) => (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full border-collapse text-sm">{children}</table>
                  </div>
                ),
                th: ({children}) => <th className="bg-slate-600 text-amber-300 px-3 py-2 border border-slate-500 text-right">{children}</th>,
                td: ({children}) => <td className="text-slate-200 px-3 py-2 border border-slate-600">{children}</td>,
              }}
            >
              {answer}
            </ReactMarkdown>

            <div className="mt-6 pt-4 border-t border-slate-600 flex justify-between items-center">
              <span className="text-slate-400 text-sm">⚠️ استشارة أولية — استشر محامياً متخصصاً</span>
              <button
                onClick={() => navigator.clipboard.writeText(answer)}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                نسخ 📋
              </button>
            </div>
          </div>
        )}

        {/* Suggested Questions */}
        {suggestions.length > 0 && !loading && (
          <div className="w-full max-w-2xl mt-4" dir="rtl">
            <p className="text-slate-400 text-sm mb-3">🤔 أسئلة مقترحة بناءً على استشارتك:</p>
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