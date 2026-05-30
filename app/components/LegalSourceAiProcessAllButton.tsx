'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CSSProperties } from 'react';

type ProcessedArticle = {
  id: string;
  articleNumber: string;
};

type BatchResponse = {
  success?: boolean;
  error?: string;
  data?: {
    processedCount: number;
    failedCount: number;
    remainingCount: number;
    done: boolean;
    processedArticles: ProcessedArticle[];
    failedArticles: { id: string; articleNumber: string; error: string }[];
  };
};

type Props = {
  sourceId: string;
  adminKey: string;
  initialPendingCount: number;
  batchSize?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(96, 165, 250, 0.45)',
  background: 'rgba(37, 99, 235, 0.24)',
  color: '#bfdbfe',
  borderRadius: '14px',
  padding: '11px 15px',
  fontSize: '14px',
  fontWeight: 900,
  cursor: 'pointer',
  minHeight: '44px',
};

const disabledButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 0.65,
  cursor: 'not-allowed',
};

const statusStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: '12px',
  lineHeight: 1.8,
  maxWidth: '360px',
};

const errorStyle: CSSProperties = {
  color: '#fecaca',
  fontSize: '12px',
  lineHeight: 1.8,
  maxWidth: '360px',
};

export default function LegalSourceAiProcessAllButton({
  sourceId,
  adminKey,
  initialPendingCount,
  batchSize = 5,
}: Props) {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [remainingCount, setRemainingCount] = useState(initialPendingCount);
  const [processedTotal, setProcessedTotal] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function processAllArticles() {
    if (isRunning || remainingCount <= 0) return;

    const confirmed = window.confirm(
      `سيتم تشغيل معالجة الذكاء الصناعي على كامل التشريع على دفعات، كل دفعة ${batchSize} مواد. هل تريد المتابعة؟`
    );

    if (!confirmed) return;

    setIsRunning(true);
    setError('');
    setMessage('بدأت معالجة التشريع بالذكاء الصناعي...');

    let keepGoing = true;
    let totalProcessedInThisRun = 0;
    let lastRemaining = remainingCount;

    try {
      while (keepGoing) {
        const response = await fetch(`/api/admin/legal-sources/${sourceId}/process-ai-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adminKey,
            batchSize,
          }),
        });

        const result = (await response.json()) as BatchResponse;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || 'فشل تنفيذ دفعة المعالجة بالذكاء الصناعي.');
        }

        const processedNumbers = result.data.processedArticles
          .map((article) => article.articleNumber)
          .join('، ');

        totalProcessedInThisRun += result.data.processedCount;
        lastRemaining = result.data.remainingCount;

        setProcessedTotal((previous) => previous + result.data!.processedCount);
        setRemainingCount(result.data.remainingCount);
        setMessage(
          result.data.processedCount > 0
            ? `تمت معالجة دفعة: المواد ${processedNumbers || 'غير محدد'}. المتبقي: ${result.data.remainingCount}.`
            : result.data.done
              ? 'اكتملت معالجة التشريع بالكامل.'
              : 'لم تتم معالجة أي مادة في هذه الدفعة.'
        );

        router.refresh();

        keepGoing =
          !result.data.done &&
          result.data.processedCount > 0 &&
          result.data.remainingCount > 0;

        if (keepGoing) {
          await sleep(900);
        }
      }

      if (totalProcessedInThisRun > 0 || lastRemaining === 0) {
        setMessage(
          lastRemaining === 0
            ? 'اكتملت معالجة التشريع بالكامل. يتم تحديث الصفحة الآن...'
            : `توقفت المعالجة. تمت معالجة ${totalProcessedInThisRun} مادة، والمتبقي ${lastRemaining}.`
        );
        await sleep(900);
        router.refresh();
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'حدث خطأ غير معروف أثناء المعالجة.');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        onClick={processAllArticles}
        disabled={isRunning || remainingCount <= 0}
        style={isRunning || remainingCount <= 0 ? disabledButtonStyle : buttonStyle}
      >
        {isRunning
          ? 'جاري معالجة التشريع...'
          : remainingCount <= 0
            ? 'تمت معالجة التشريع'
            : `معالجة التشريع كاملًا بالذكاء الصناعي (${remainingCount})`}
      </button>

      {message && <span style={statusStyle}>{message}</span>}
      {processedTotal > 0 && !error && (
        <span style={statusStyle}>المواد المعالجة في هذه الجلسة: {processedTotal}</span>
      )}
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
}
