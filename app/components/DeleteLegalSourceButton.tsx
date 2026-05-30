'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CSSProperties } from 'react';

type DeleteLegalSourceButtonProps = {
  sourceId: string;
  adminKey: string;
  sourceTitle: string;
  style?: CSSProperties;
};

export default function DeleteLegalSourceButton({
  sourceId,
  adminKey,
  sourceTitle,
  style,
}: DeleteLegalSourceButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function deleteSource() {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف التشريع: ${sourceTitle}؟ سيتم حذف جميع مواده من النظام ولا يمكن التراجع عن هذه العملية.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);

      const res = await fetch(`/api/admin/legal-sources/${sourceId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: adminKey }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'فشل حذف التشريع.');
      }

      router.push(`/admin/legal-sources?key=${encodeURIComponent(adminKey)}&saved=source-deleted`);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'حدث خطأ أثناء حذف التشريع.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button type="button" onClick={deleteSource} disabled={deleting} style={style}>
      {deleting ? 'جاري الحذف...' : 'حذف التشريع'}
    </button>
  );
}
