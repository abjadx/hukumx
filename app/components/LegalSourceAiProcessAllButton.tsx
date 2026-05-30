'use client';

import { useRouter } from 'next/navigation';
import { CSSProperties, useMemo, useRef, useState } from 'react';

type Props = {
  sourceId: string;
  adminKey: string;
  initialRemaining?: number;
  batchSize?: number;
  style?: CSSProperties;
};

type ProcessResponse = {
  success?: boolean;
  error?: string;
  data?: {
    processedCount?: number;
    totalArticles?: number;
    processedArticles?: number;
    remainingArticles?: number;
    processedArticleNumbers?: string[];
  };
};

const defaultButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(96, 165, 250, 0.55)',
  background: 'rgba(37, 99, 235, 0.22)',
  color: '#dbeafe',
  borderRadius: '16px',
  padding: '14px 18px',
  fontSize: '14px',
  fontWeight: 900,
  cursor: 'pointer',
  textDecoration: 'none',
  minHeight: '48px',
};

export default function LegalSourceAiProcessAllButton({
  sourceId,
  adminKey,
  initialRemaining = 0,
  batchSize = 5,
  style,
}: Props) {
  const router = useRouter();
  const shouldStopRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [processedInSession, setProcessedInSession] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const buttonLabel = useMemo(() => {
    if (isProcessing) return `جاري المعالجة... المتبقي ${remaining}`;
    if (remaining > 0) return `معالجة التشريع كاملًا بالذكاء الصناعي (${remaining})`;
    return 'تمت معالجة كامل التشريع بالذكاء الصناعي';
  }, [isProcessing, remaining]);

  async function processOneBatch() {
    const response = await fetch(`/api/admin/legal-sources/${encodeURIComponent(sourceId)}/process-ai-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: adminKey,
        batchSize,
      }),
    });

    const json = (await response.json()) as ProcessResponse;

    if (!response.ok || !json.success) {
      throw new Error(json.error || 'فشلت معالجة دفعة الذكاء الصناعي.');
    }

    return json.data || {};
  }

  async function processAll() {
    if (isProcessing || remaining <= 0) return;

    shouldStopRef.current = false;
    setIsProcessing(true);
    setError('');
    setMessage('بدأت معالجة التشريع بالذكاء الصناعي...');

    let safetyCounter = 0;

    try {
      while (!shouldStopRef.current) {
        safetyCounter += 1;

        if (safetyCounter > 1000) {
          throw new Error('تم إيقاف المعالجة احتياطيًا بسبب عدد دورات غير طبيعي.');
        }

        const data = await processOneBatch();
        const processedCount = data.processedCount || 0;
        const nextRemaining = data.remainingArticles ?? 0;
        const processedNumbers = data.processedArticleNumbers || [];

        setProcessedInSession((value) => value + processedCount);
        setRemaining(nextRemaining);

        setMessage(
          processedNumbers.length
            ? `تمت معالجة المواد: ${processedNumbers.join('، ')}. المتبقي: ${nextRemaining}.`
            : `لا توجد مواد جديدة في هذه الدفعة. المتبقي: ${nextRemaining}.`
        );

        router.refresh();

        if (processedCount === 0 || nextRemaining <= 0) {
          break;
        }
      }

      setMessage((current) =>
        shouldStopRef.current
          ? `تم إيقاف المعالجة مؤقتًا. ${current}`
          : `انتهت المعالجة أو لا توجد مواد إضافية. ${current}`
      );
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'حدث خطأ غير معروف أثناء المعالجة.');
    } finally {
      setIsProcessing(false);
      router.refresh();
    }
  }

  function stopProcessing() {
    shouldStopRef.current = true;
    setMessage('سيتم إيقاف المعالجة بعد انتهاء الدفعة الحالية.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '280px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={processAll}
          disabled={isProcessing || remaining <= 0}
          style={{
            ...defaultButtonStyle,
            ...style,
            opacity: isProcessing || remaining <= 0 ? 0.72 : 1,
            cursor: isProcessing || remaining <= 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {buttonLabel}
        </button>

        {isProcessing && (
          <button
            type="button"
            onClick={stopProcessing}
            style={{
              ...defaultButtonStyle,
              border: '1px solid rgba(248, 113, 113, 0.45)',
              background: 'rgba(127, 29, 29, 0.35)',
              color: '#fecaca',
            }}
          >
            إيقاف بعد هذه الدفعة
          </button>
        )}
      </div>

      <div style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.9 }}>
        عالجت هذه الجلسة: {processedInSession} — المتبقي: {remaining}
      </div>

      {message && <div style={{ color: '#bfdbfe', fontSize: '13px', lineHeight: 1.9 }}>{message}</div>}
      {error && <div style={{ color: '#fecaca', fontSize: '13px', lineHeight: 1.9 }}>{error}</div>}
    </div>
  );
}
