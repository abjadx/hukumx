'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

type LegalCase = {
  id: string;
  title: string;
  country: string;
  caseType: string;
  status: string;
  clientName?: string | null;
  opponentName?: string | null;
  courtName?: string | null;
  caseNumber?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    documents: number;
    events: number;
    recommendations: number;
  };
};

const caseTypeOptions = [
  { value: 'CIVIL', label: 'مدني' },
  { value: 'CRIMINAL', label: 'جزائي' },
  { value: 'COMMERCIAL', label: 'تجاري' },
  { value: 'LABOR', label: 'عمالي' },
  { value: 'FAMILY', label: 'أحوال شخصية' },
  { value: 'ADMINISTRATIVE', label: 'إداري' },
  { value: 'CONTRACT', label: 'عقود' },
  { value: 'OTHER', label: 'أخرى' },
];

const statusOptions = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'ACTIVE', label: 'نشطة' },
  { value: 'UNDER_REVIEW', label: 'قيد المراجعة' },
  { value: 'CLOSED', label: 'مغلقة' },
  { value: 'ARCHIVED', label: 'مؤرشفة' },
];

function getCaseTypeLabel(value: string) {
  return caseTypeOptions.find((item) => item.value === value)?.label || value;
}

function getStatusLabel(value: string) {
  return statusOptions.find((item) => item.value === value)?.label || value;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('ar-JO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function CasesPage() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [form, setForm] = useState({
    title: '',
    country: 'JO',
    caseType: 'CIVIL',
    status: 'ACTIVE',
    clientName: '',
    opponentName: '',
    courtName: '',
    caseNumber: '',
    description: '',
  });

  async function loadCases() {
    try {
      setLoading(true);
      setError('');

      const res = await fetch('/api/cases', {
        cache: 'no-store',
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في جلب القضايا');
      }

      setCases(json.data || []);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب القضايا');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setCreating(true);
      setError('');
      setSuccessMessage('');

      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في إنشاء القضية');
      }

      setSuccessMessage('تم إنشاء القضية بنجاح');

      setForm({
        title: '',
        country: 'JO',
        caseType: 'CIVIL',
        status: 'ACTIVE',
        clientName: '',
        opponentName: '',
        courtName: '',
        caseNumber: '',
        description: '',
      });

      await loadCases();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إنشاء القضية');
    } finally {
      setCreating(false);
    }
  }

  async function deleteCase(caseId: string, caseTitle: string) {
    const confirmed = window.confirm(
      `هل أنت متأكد من حذف القضية: ${caseTitle}؟ سيتم حذف المستندات والإجراءات والتوصيات والتحليلات المرتبطة بها.`
    );

    if (!confirmed) return;

    try {
      setDeleting(caseId);
      setError('');
      setSuccessMessage('');

      const res = await fetch(`/api/cases/${caseId}`, {
        method: 'DELETE',
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في حذف القضية');
      }

      setSuccessMessage('تم حذف القضية بنجاح');
      await loadCases();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حذف القضية');
    } finally {
      setDeleting('');
    }
  }

  return (
    <main style={styles.page} dir="rtl">
      <section style={styles.header}>
        <div>
          <p style={styles.badge}>Hukumx Cases</p>
          <h1 style={styles.title}>نظام إدارة القضايا</h1>
          <p style={styles.subtitle}>
            إنشاء ملف قضية، ربط المستندات، متابعة التواريخ، وبناء تحليل قانوني ذكي.
          </p>
        </div>

        <button style={styles.refreshButton} onClick={loadCases}>
          تحديث
        </button>
      </section>

      {error && <div style={styles.errorBox}>{error}</div>}
      {successMessage && <div style={styles.successBox}>{successMessage}</div>}

      <section style={styles.grid}>
        <div style={styles.formCard}>
          <h2 style={styles.cardTitle}>إنشاء قضية جديدة</h2>

          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              عنوان القضية
              <input
                style={styles.input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: قضية مطالبة مالية"
              />
            </label>

            <div style={styles.twoColumns}>
              <label style={styles.label}>
                الدولة
                <select
                  style={styles.input}
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                >
                  <option value="JO">الأردن</option>
                  <option value="SA">السعودية</option>
                  <option value="AE">الإمارات</option>
                  <option value="EG">مصر</option>
                  <option value="IQ">العراق</option>
                </select>
              </label>

              <label style={styles.label}>
                نوع القضية
                <select
                  style={styles.input}
                  value={form.caseType}
                  onChange={(e) => setForm({ ...form, caseType: e.target.value })}
                >
                  {caseTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={styles.twoColumns}>
              <label style={styles.label}>
                حالة القضية
                <select
                  style={styles.input}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                رقم القضية
                <input
                  style={styles.input}
                  value={form.caseNumber}
                  onChange={(e) =>
                    setForm({ ...form, caseNumber: e.target.value })
                  }
                  placeholder="مثال: 123/2026"
                />
              </label>
            </div>

            <div style={styles.twoColumns}>
              <label style={styles.label}>
                اسم الموكل
                <input
                  style={styles.input}
                  value={form.clientName}
                  onChange={(e) =>
                    setForm({ ...form, clientName: e.target.value })
                  }
                  placeholder="اسم صاحب القضية"
                />
              </label>

              <label style={styles.label}>
                اسم الخصم
                <input
                  style={styles.input}
                  value={form.opponentName}
                  onChange={(e) =>
                    setForm({ ...form, opponentName: e.target.value })
                  }
                  placeholder="اسم الطرف الآخر"
                />
              </label>
            </div>

            <label style={styles.label}>
              المحكمة
              <input
                style={styles.input}
                value={form.courtName}
                onChange={(e) => setForm({ ...form, courtName: e.target.value })}
                placeholder="مثال: محكمة بداية عمان"
              />
            </label>

            <label style={styles.label}>
              وصف مختصر
              <textarea
                style={styles.textarea}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="اكتب وصفًا مختصرًا للقضية..."
              />
            </label>

            <button style={styles.submitButton} disabled={creating}>
              {creating ? 'جاري الإنشاء...' : 'إنشاء القضية'}
            </button>
          </form>
        </div>

        <div style={styles.listCard}>
          <div style={styles.listHeader}>
            <h2 style={styles.cardTitle}>القضايا</h2>
            <span style={styles.countBadge}>{cases.length}</span>
          </div>

          {loading ? (
            <p style={styles.muted}>جاري تحميل القضايا...</p>
          ) : cases.length === 0 ? (
            <p style={styles.muted}>لا توجد قضايا بعد.</p>
          ) : (
            <div style={styles.caseList}>
              {cases.map((item) => (
                <div key={item.id} style={styles.caseCard}>
                  <div style={styles.caseTop}>
                    <div>
                      <h3 style={styles.caseTitle}>{item.title}</h3>
                      <p style={styles.caseMeta}>
                        {getCaseTypeLabel(item.caseType)} · {item.country}
                        {item.caseNumber ? ` · رقم ${item.caseNumber}` : ''}
                      </p>
                    </div>

                    <span style={styles.statusPill}>{getStatusLabel(item.status)}</span>
                  </div>

                  <p style={styles.caseDescription}>
                    {item.description || 'لا يوجد وصف مختصر لهذه القضية.'}
                  </p>

                  <div style={styles.infoRow}>
                    <span>الموكل: {item.clientName || 'غير محدد'}</span>
                    <span>الخصم: {item.opponentName || 'غير محدد'}</span>
                    <span>آخر تحديث: {formatDate(item.updatedAt)}</span>
                  </div>

                  <div style={styles.statsRow}>
                    <span>المستندات: {item._count?.documents ?? 0}</span>
                    <span>الإجراءات: {item._count?.events ?? 0}</span>
                    <span>التوصيات: {item._count?.recommendations ?? 0}</span>
                  </div>

                  <div style={styles.actionsRow}>
                    <Link href={`/cases/${item.id}`} style={styles.openButton}>
                      فتح القضية
                    </Link>

                    <button
                      style={styles.deleteButton}
                      onClick={() => deleteCase(item.id, item.title)}
                      disabled={deleting === item.id}
                    >
                      {deleting === item.id ? 'جاري الحذف...' : 'حذف القضية'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e5e7eb',
    padding: '40px',
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '24px',
    marginBottom: '28px',
  },
  badge: {
    display: 'inline-block',
    background: 'rgba(37, 99, 235, 0.18)',
    color: '#93c5fd',
    border: '1px solid rgba(147, 197, 253, 0.28)',
    padding: '6px 12px',
    borderRadius: '999px',
    fontSize: '13px',
    marginBottom: '12px',
  },
  title: {
    margin: 0,
    fontSize: '34px',
    fontWeight: 800,
    color: '#ffffff',
  },
  subtitle: {
    marginTop: '10px',
    color: '#94a3b8',
    fontSize: '16px',
    maxWidth: '720px',
    lineHeight: 1.8,
  },
  refreshButton: {
    background: '#1e293b',
    color: '#e5e7eb',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '11px 18px',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '430px 1fr',
    gap: '24px',
    alignItems: 'start',
  },
  formCard: {
    background: '#111827',
    border: '1px solid #243244',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  listCard: {
    background: '#111827',
    border: '1px solid #243244',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  cardTitle: {
    margin: 0,
    marginBottom: '18px',
    fontSize: '22px',
    color: '#ffffff',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  twoColumns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: '#cbd5e1',
    fontSize: '14px',
  },
  input: {
    background: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    borderRadius: '12px',
    padding: '12px 13px',
    outline: 'none',
    fontSize: '14px',
  },
  textarea: {
    background: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    borderRadius: '12px',
    padding: '12px 13px',
    outline: 'none',
    fontSize: '14px',
    minHeight: '100px',
    resize: 'vertical',
  },
  submitButton: {
    marginTop: '8px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '13px 18px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  countBadge: {
    background: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid #334155',
    borderRadius: '999px',
    padding: '6px 12px',
    fontSize: '13px',
  },
  muted: {
    color: '#94a3b8',
  },
  caseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  caseCard: {
    display: 'block',
    background: '#0f172a',
    border: '1px solid #243244',
    borderRadius: '16px',
    padding: '18px',
  },
  caseTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'flex-start',
  },
  caseTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '18px',
  },
  statusPill: {
    background: 'rgba(34, 197, 94, 0.14)',
    color: '#86efac',
    border: '1px solid rgba(134, 239, 172, 0.22)',
    borderRadius: '999px',
    padding: '5px 10px',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  caseMeta: {
    margin: '10px 0 0',
    color: '#93c5fd',
    fontSize: '14px',
  },
  caseDescription: {
    margin: '12px 0 0',
    color: '#cbd5e1',
    lineHeight: 1.7,
    fontSize: '14px',
  },
  infoRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '14px',
    color: '#94a3b8',
    fontSize: '13px',
  },
  statsRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '12px',
    color: '#94a3b8',
    fontSize: '13px',
  },
  actionsRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '16px',
  },
  openButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    background: '#2563eb',
    color: '#ffffff',
    border: '1px solid #2563eb',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '14px',
    fontWeight: 700,
  },
  deleteButton: {
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#fecaca',
    border: '1px solid rgba(248, 113, 113, 0.28)',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  errorBox: {
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#fecaca',
    border: '1px solid rgba(248, 113, 113, 0.25)',
    borderRadius: '14px',
    padding: '12px 16px',
    marginBottom: '18px',
  },
  successBox: {
    background: 'rgba(34, 197, 94, 0.12)',
    color: '#bbf7d0',
    border: '1px solid rgba(74, 222, 128, 0.25)',
    borderRadius: '14px',
    padding: '12px 16px',
    marginBottom: '18px',
  },
};