'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';

type Props = {
  sourceId: string;
  adminKey: string;
  initialReadyCount: number;
  style?: CSSProperties;
};

export default function LegalSourceApproveProcessedButton({
  sourceId,
  adminKey,
  initialReadyCount,
  style,
}: Props) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [message, setMessage] = useState('');

  async function approveProcessedArticles() {
    if (isApproving) return;

    if (initialReadyCount <= 0) {
      setMessage('لا توجد مواد معالجة جاهزة للاعتماد.');
      return;
    }

    const confirmed = window.confirm(
      `سيتم اعتماد ${initialReadyCount} مادة معالجة بالذكاء الصناعي دفعة واحدة. هل تريد المتابعة؟`
    );

    if (!confirmed) return;

    setIsApproving(true);
    setMessage('جاري اعتماد المواد المعالجة...');

    try {
      const response = await fetch(`/api/admin/legal-sources/${encodeURIComponent(sourceId)}/approve-processed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminKey }),
      });

      const payload = await response.json().catch(() => null) as
        | {
            success?: boolean;
            error?: string;
            data?: {
              approvedCount?: number;
              skippedCount?: number;
            };
          }
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'فشل اعتماد المواد المعالجة.');
      }

      setMessage(`تم اعتماد ${payload.data?.approvedCount || 0} مادة بنجاح.`);
      router.refresh();
      window.setTimeout(() => {
        window.location.reload();
      }, 650);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'حدث خطأ غير معروف أثناء الاعتماد.');
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '8px' }}>
      <button
        type="button"
        onClick={approveProcessedArticles}
        disabled={isApproving || initialReadyCount <= 0}
        style={{
          ...(style || {}),
          opacity: isApproving || initialReadyCount <= 0 ? 0.62 : 1,
          cursor: isApproving || initialReadyCount <= 0 ? 'not-allowed' : 'pointer',
        }}
        title={
          initialReadyCount > 0
            ? `اعتماد ${initialReadyCount} مادة معالجة دفعة واحدة`
            : 'لا توجد مواد معالجة جاهزة للاعتماد'
        }
      >
        {isApproving
          ? 'جاري اعتماد المواد...'
          : `اعتماد المواد المعالجة دفعة واحدة (${initialReadyCount})`}
      </button>

      {message && (
        <span style={{ color: '#fde68a', fontSize: '12px', fontWeight: 800, maxWidth: 320 }}>
          {message}
        </span>
      )}
    </div>
  );
}
