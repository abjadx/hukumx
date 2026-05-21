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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <nav className="flex justify-between items-center px-8 py-4 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-white">
          ⚖️ Hukumx <span className="text-amber-400">حكمx</span>
        </h1>
        <div className="flex gap-4">
          <button className="text-slate-300 hover:text-white px-4 py-2">تسجيل دخول</button>
          <button className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2 rounded-lg">ابدأ مجاناً</button>
        </div>
      </nav>

      <div className="flex flex-col items-center justify-center text-center px-4 py-16">
        <h2 className="text-5xl font-bold text-white mb-6">
          استشارتك القانونية<br/>
          <span className="text-amber-400">بالذكاء الاصطناعي</span>
        </h2>
        <p className="text-slate-300 text-xl mb-10 max-w-2xl">
          احصل على استشارة قانونية فورية، أو تواصل مع محامي متخصص
        </p>

        <div className="w-full max-w-2xl bg-slate-700 rounded-2xl p-4 flex gap-3">
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
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold px-8 py-3 rounded-xl"
          >
            {loading ? '...' : 'اسأل'}
          </button>
        </div>

        {answer && (
          <div className="w-full max-w-2xl mt-8 bg-slate-700 rounded-2xl p-6 text-right" dir="rtl">
            <h3 className="text-amber-400 font-bold mb-3">⚖️ الاستشارة القانونية:</h3>
            <div className="text-slate-200 leading-relaxed whitespace-pre-wrap prose prose-invert max-w-none"
  dangerouslySetInnerHTML={{__html: answer.replace(/### /g, '<h3 class="text-amber-400 font-bold mt-4">').replace(/## /g, '<h2 class="text-amber-300 font-bold mt-6">').replace(/# /g, '<h1 class="text-amber-200 font-bold mt-6">').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}}
/>
          </div>
        )}
      </div>
    </main>
  );
}