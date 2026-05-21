'use client';
import { useState } from 'react';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const askQuestion = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setAnswer(data.answer);
    } catch {
      setAnswer('حدث خطأ، حاول مرة أخرى');
    }
    setLoading(false);
  };

  const formatAnswer = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-amber-400 mt-6 mb-3">{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold text-amber-300 mt-5 mb-2">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-amber-200 mt-4 mb-2">{line.slice(4)}</h3>;
        if (line.startsWith('---')) return <hr key={i} className="border-slate-600 my-4"/>;
        if (line.startsWith('- ') || line.startsWith('• ')) return <li key={i} className="text-slate-200 mr-4 mb-1 list-disc">{line.slice(2)}</li>;
        if (line.match(/^\|.*\|$/)) return <p key={i} className="text-slate-300 font-mono text-sm my-1 bg-slate-800 px-3 py-1 rounded">{line}</p>;
        if (line.trim() === '') return <br key={i}/>;
        return <p key={i} className="text-slate-200 mb-2 leading-relaxed"
          dangerouslySetInnerHTML={{__html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')}}
        />;
      });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <nav className="flex justify-between items-center px-8 py-4 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-white">⚖️ Hukumx <span className="text-amber-400">حكمx</span></h1>
        <div className="flex gap-4">
          <button className="text-slate-300 hover:text-white px-4 py-2">تسجيل دخول</button>
          <button className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2 rounded-lg">ابدأ مجاناً</button>
        </div>
      </nav>

      <div className="flex flex-col items-center px-4 py-16">
        <h2 className="text-5xl font-bold text-white mb-4 text-center">
          استشارتك القانونية<br/>
          <span className="text-amber-400">بالذكاء الاصطناعي</span>
        </h2>
        <p className="text-slate-300 text-xl mb-10 text-center max-w-2xl">
          احصل على استشارة قانونية فورية، أو تواصل مع محامي متخصص
        </p>

        <div className="w-full max-w-2xl bg-slate-700 rounded-2xl p-4 flex gap-3 shadow-xl">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
            placeholder="اكتب سؤالك القانوني هنا..."
            className="flex-1 bg-transparent text-white placeholder-slate-400 outline-none text-right text-lg px-2"
            dir="rtl"
          />
          <button
            onClick={askQuestion}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold px-8 py-3 rounded-xl transition-all"
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

        {loading && (
          <div className="w-full max-w-2xl mt-8 bg-slate-700 rounded-2xl p-6 text-right animate-pulse">
            <div className="h-4 bg-slate-600 rounded w-3/4 mr-auto mb-3"/>
            <div className="h-4 bg-slate-600 rounded w-full mb-3"/>
            <div className="h-4 bg-slate-600 rounded w-5/6 mr-auto"/>
          </div>
        )}

        {answer && !loading && (
          <div className="w-full max-w-2xl mt-8 bg-slate-700 rounded-2xl p-6 text-right shadow-xl border border-slate-600" dir="rtl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-600">
              <span className="text-amber-400 text-xl">⚖️</span>
              <h3 className="text-amber-400 font-bold text-lg">الاستشارة القانونية</h3>
            </div>
            <div className="space-y-1">{formatAnswer(answer)}</div>
            <div className="mt-6 pt-4 border-t border-slate-600 flex justify-between items-center">
              <span className="text-slate-400 text-sm">⚠️ هذه استشارة أولية — استشر محامياً متخصصاً</span>
              <button
                onClick={() => {navigator.clipboard.writeText(answer)}}
                className="text-slate-400 hover:text-white text-sm flex items-center gap-1"
              >
                نسخ 📋
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}