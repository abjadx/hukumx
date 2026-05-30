'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { CSSProperties } from 'react';

type ImportResult = {
  sourceId: string;
  sourceSlug: string;
  sourceTitle: string;
  legislationType: string;
  legislationTypeLabel: string;
  fileName: string;
  extractedTextLength: number;
  insertedArticlesCount: number;
  parsingMode: 'AI' | 'AUTO_SPLIT' | string;
  reviewStatus: string;
  preview: {
    articleNumber: string;
    text: string;
  }[];
};

const countryOptions = [
  { code: 'JO', nameAr: 'الأردن', nameEn: 'Jordan' },
  { code: 'SA', nameAr: 'السعودية', nameEn: 'Saudi Arabia' },
  { code: 'AE', nameAr: 'الإمارات', nameEn: 'United Arab Emirates' },
  { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt' },
  { code: 'IQ', nameAr: 'العراق', nameEn: 'Iraq' },
];

const legislationTypeOptions = [
  { value: 'CONSTITUTION', label: 'دستور' },
  { value: 'LAW', label: 'قانون' },
  { value: 'REGULATION', label: 'نظام' },
  { value: 'INSTRUCTIONS', label: 'تعليمات' },
  { value: 'DECISION', label: 'قرار' },
  { value: 'OTHER', label: 'أخرى' },
];

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}


export default function ImportLegalSourcePage() {
  return (
    <Suspense
      fallback={
        <main style={styles.page} dir="rtl">
          <div style={styles.container}>
            <section style={styles.hero}>
              <div>
                <p style={styles.label}>Hukumx Admin</p>
                <h1 style={styles.title}>جاري تجهيز شاشة إدخال التشريعات...</h1>
                <p style={styles.subtitle}>يرجى الانتظار لحظة.</p>
              </div>
            </section>
          </div>
        </main>
      }
    >
      <ImportLegalSourcePageContent />
    </Suspense>
  );
}

function ImportLegalSourcePageContent() {
  const searchParams = useSearchParams();
  const keyFromUrl = searchParams.get('key') || '';

  const [adminKey, setAdminKey] = useState(keyFromUrl);
  const [countryCode, setCountryCode] = useState('JO');
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [legislationType, setLegislationType] = useState('LAW');
  const [slug, setSlug] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const selectedCountry = useMemo(
    () => countryOptions.find((item) => item.code === countryCode) || countryOptions[0],
    [countryCode]
  );

  const suggestedSlug = useMemo(() => {
    if (!titleAr.trim()) return '';
    return normalizeSlug(`${countryCode}-${legislationType}-${titleAr}`);
  }, [countryCode, legislationType, titleAr]);

  async function submitImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      setResult(null);

      if (!adminKey.trim()) {
        throw new Error('يرجى إدخال مفتاح الإدارة.');
      }

      if (!titleAr.trim()) {
        throw new Error('يرجى إدخال عنوان التشريع.');
      }

      if (!file) {
        throw new Error('يرجى اختيار ملف PDF أو TXT.');
      }

      const formData = new FormData();
      formData.append('key', adminKey.trim());
      formData.append('countryCode', selectedCountry.code);
      formData.append('countryNameAr', selectedCountry.nameAr);
      formData.append('countryNameEn', selectedCountry.nameEn);
      formData.append('titleAr', titleAr.trim());
      formData.append('titleEn', titleEn.trim());
      formData.append('legislationType', legislationType);
      formData.append('slug', slug.trim() || suggestedSlug);
      formData.append('replaceExisting', replaceExisting ? 'true' : 'false');
      formData.append('file', file);

      const res = await fetch('/api/admin/legal-sources/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'فشل إدخال التشريع.');
      }

      setResult(json.data);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إدخال التشريع.');
    } finally {
      setLoading(false);
    }
  }

  const keyQuery = adminKey ? `key=${encodeURIComponent(adminKey)}` : '';

  return (
    <main style={styles.page} dir="rtl">
      <div style={styles.container}>
        <section style={styles.hero}>
          <div>
            <p style={styles.label}>Hukumx Admin</p>
            <h1 style={styles.title}>إدخال تشريع من ملف PDF أو TXT</h1>
            <p style={styles.subtitle}>
              ارفع ملف التشريع، وسيقوم النظام باستخراج النص وتقسيمه إلى مواد قانونية
              وإدخاله داخل قاعدة البيانات بحالة تحتاج مراجعة قبل الاعتماد النهائي.
            </p>
          </div>

          <div style={styles.heroActions}>
            <Link href={`/admin${keyQuery ? `?${keyQuery}` : ''}`} style={styles.secondaryLink}>
              مركز الإدارة
            </Link>
            <Link
              href={`/admin/legal-sources${keyQuery ? `?${keyQuery}` : ''}`}
              style={styles.secondaryLink}
            >
              إدارة المصادر
            </Link>
          </div>
        </section>

        <section style={styles.noticeBox}>
          <strong>مهم:</strong> هذه المرحلة تدعم PDF النصي و TXT فقط. ملفات PDF المصوّرة
          تحتاج OCR وسيتم التعامل معها في مرحلة لاحقة. جميع المواد تدخل بحالة
          "تحتاج مراجعة" حتى يتم اعتمادها من شاشة المراجعة.
        </section>

        {error && <div style={styles.errorBox}>{error}</div>}

        {result && (
          <section style={styles.successPanel}>
            <div style={styles.successHeader}>
              <div>
                <p style={styles.successBadge}>تم إدخال التشريع بنجاح</p>
                <h2 style={styles.cardTitle}>{result.sourceTitle}</h2>
                <p style={styles.muted}>
                  الملف: {result.fileName} · النوع: {result.legislationTypeLabel} ·
                  طريقة المعالجة: {result.parsingMode === 'AI' ? 'ذكاء صناعي' : 'تقسيم آلي'}
                </p>
              </div>

              <div style={styles.bigNumberBox}>
                <span>عدد المواد</span>
                <strong>{result.insertedArticlesCount}</strong>
              </div>
            </div>

            <div style={styles.resultGrid}>
              <Info label="slug" value={result.sourceSlug} />
              <Info label="حالة المواد" value="تحتاج مراجعة" />
              <Info
                label="حجم النص المستخرج"
                value={`${result.extractedTextLength.toLocaleString('ar-JO')} حرف`}
              />
            </div>

            {result.preview?.length > 0 && (
              <div style={styles.previewBox}>
                <h3 style={styles.smallTitle}>معاينة أول المواد المدخلة</h3>
                {result.preview.map((item) => (
                  <div key={item.articleNumber} style={styles.previewArticle}>
                    <strong>المادة {item.articleNumber}</strong>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.actionsRow}>
              <Link
                href={`/admin/legal-sources?${keyQuery}&status=needs_review&q=${encodeURIComponent(
                  result.preview?.[0]?.articleNumber || ''
                )}`}
                style={styles.primaryLink}
              >
                مراجعة المواد المدخلة
              </Link>

              <Link
                href={`/admin/legal-sources?${keyQuery}&q=${encodeURIComponent(result.sourceTitle)}`}
                style={styles.secondaryLink}
              >
                فتح المصدر في الإدارة
              </Link>
            </div>
          </section>
        )}

        <section style={styles.formLayout}>
          <form onSubmit={submitImport} style={styles.formCard}>
            <h2 style={styles.cardTitle}>بيانات التشريع</h2>

            <label style={styles.labelInput}>
              مفتاح الإدارة
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                style={styles.input}
                placeholder="ADMIN_ACCESS_KEY"
              />
            </label>

            <div style={styles.twoColumns}>
              <label style={styles.labelInput}>
                الدولة
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  style={styles.input}
                >
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.nameAr}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.labelInput}>
                نوع التشريع
                <select
                  value={legislationType}
                  onChange={(e) => setLegislationType(e.target.value)}
                  style={styles.input}
                >
                  {legislationTypeOptions.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label style={styles.labelInput}>
              عنوان التشريع بالعربية
              <input
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                style={styles.input}
                placeholder="مثال: قانون أصول المحاكمات المدنية الأردني"
              />
            </label>

            <label style={styles.labelInput}>
              العنوان بالإنجليزية اختياري
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                style={styles.input}
                placeholder="Optional English title"
              />
            </label>

            <label style={styles.labelInput}>
              slug اختياري
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                style={styles.input}
                placeholder={suggestedSlug || 'سيتم توليده تلقائيًا'}
              />
            </label>

            <label style={styles.fileBox}>
              <span>ملف التشريع PDF أو TXT</span>
              <input
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={styles.fileInput}
              />
              {file && (
                <small style={styles.muted}>
                  الملف المختار: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                </small>
              )}
            </label>

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
              />
              استبدال التشريع إذا كان موجودًا بنفس slug
            </label>

            <button style={styles.submitButton} disabled={loading}>
              {loading ? 'جاري الاستخراج والمعالجة...' : 'إدخال التشريع ومعالجته'}
            </button>
          </form>

          <aside style={styles.sideCard}>
            <h2 style={styles.cardTitle}>ما الذي سيحدث؟</h2>

            <ol style={styles.stepsList}>
              <li>استخراج النص من ملف PDF أو TXT.</li>
              <li>إرسال النص للذكاء الصناعي لتحديد المواد وفصلها.</li>
              <li>إنشاء مصدر قانوني جديد حسب النوع: قانون، نظام، تعليمات، قرار، دستور.</li>
              <li>إدخال المواد في جدول المواد القانونية.</li>
              <li>وضع المواد بحالة تحتاج مراجعة قبل اعتمادها.</li>
              <li>إتاحتها لاحقًا للتحليل والمذكرات بعد الاعتماد.</li>
            </ol>

            <div style={styles.typeLegend}>
              {legislationTypeOptions.map((type) => (
                <span key={type.value}>{type.label}</span>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at top, #1e293b 0%, #0f172a 42%, #020617 100%)',
    color: '#f8fafc',
    padding: '34px',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  hero: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.82))',
    borderRadius: '30px',
    padding: '30px',
    marginBottom: '22px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    boxShadow: '0 26px 80px rgba(0,0,0,0.36)',
  },
  label: {
    display: 'inline-flex',
    color: '#fbbf24',
    border: '1px solid rgba(251, 191, 36, 0.32)',
    background: 'rgba(251, 191, 36, 0.1)',
    borderRadius: '999px',
    padding: '7px 13px',
    fontSize: '13px',
    fontWeight: 900,
    marginBottom: '14px',
  },
  title: {
    margin: 0,
    color: '#ffffff',
    fontSize: '36px',
    fontWeight: 900,
    lineHeight: 1.45,
  },
  subtitle: {
    margin: '12px 0 0',
    color: '#cbd5e1',
    lineHeight: 2,
    fontSize: '16px',
    maxWidth: '820px',
  },
  heroActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  noticeBox: {
    border: '1px solid rgba(251, 191, 36, 0.38)',
    background: 'rgba(120, 53, 15, 0.22)',
    color: '#fde68a',
    borderRadius: '20px',
    padding: '16px 18px',
    marginBottom: '20px',
    lineHeight: 2,
  },
  formLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 380px',
    gap: '22px',
    alignItems: 'start',
  },
  formCard: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(15, 23, 42, 0.9)',
    borderRadius: '26px',
    padding: '26px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  sideCard: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(15, 23, 42, 0.78)',
    borderRadius: '26px',
    padding: '26px',
    position: 'sticky',
    top: '100px',
  },
  cardTitle: {
    margin: 0,
    marginBottom: '18px',
    color: '#ffffff',
    fontSize: '23px',
    fontWeight: 900,
  },
  twoColumns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  },
  labelInput: {
    display: 'flex',
    flexDirection: 'column',
    gap: '9px',
    color: '#cbd5e1',
    fontSize: '14px',
    marginBottom: '14px',
    fontWeight: 800,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(2, 6, 23, 0.72)',
    color: '#f8fafc',
    borderRadius: '16px',
    padding: '14px 16px',
    outline: 'none',
    fontSize: '14px',
  },
  fileBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    border: '1px dashed rgba(147, 197, 253, 0.38)',
    background: 'rgba(30, 41, 59, 0.5)',
    borderRadius: '18px',
    padding: '18px',
    color: '#bfdbfe',
    marginBottom: '14px',
    fontWeight: 900,
  },
  fileInput: {
    color: '#e5e7eb',
    fontSize: '14px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    color: '#cbd5e1',
    margin: '10px 0 18px',
    lineHeight: 1.8,
  },
  submitButton: {
    width: '100%',
    border: 'none',
    background: '#f59e0b',
    color: '#020617',
    borderRadius: '16px',
    padding: '15px 22px',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: '15px',
  },
  secondaryLink: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    textDecoration: 'none',
    background: 'rgba(37, 99, 235, 0.2)',
    color: '#bfdbfe',
    border: '1px solid rgba(96, 165, 250, 0.34)',
    borderRadius: '14px',
    padding: '11px 15px',
    fontWeight: 900,
  },
  primaryLink: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    textDecoration: 'none',
    background: '#f59e0b',
    color: '#020617',
    borderRadius: '14px',
    padding: '11px 15px',
    fontWeight: 900,
  },
  errorBox: {
    border: '1px solid rgba(248, 113, 113, 0.5)',
    background: 'rgba(127, 29, 29, 0.25)',
    color: '#fecaca',
    borderRadius: '18px',
    padding: '16px 18px',
    marginBottom: '18px',
    lineHeight: 1.9,
  },
  successPanel: {
    border: '1px solid rgba(34, 197, 94, 0.38)',
    background: 'rgba(20, 83, 45, 0.18)',
    borderRadius: '26px',
    padding: '24px',
    marginBottom: '22px',
  },
  successHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '18px',
    flexWrap: 'wrap',
    marginBottom: '18px',
  },
  successBadge: {
    display: 'inline-flex',
    color: '#bbf7d0',
    border: '1px solid rgba(74, 222, 128, 0.3)',
    background: 'rgba(34, 197, 94, 0.12)',
    borderRadius: '999px',
    padding: '7px 13px',
    fontSize: '13px',
    fontWeight: 900,
    margin: '0 0 12px',
  },
  muted: {
    color: '#94a3b8',
    lineHeight: 1.9,
  },
  bigNumberBox: {
    minWidth: '160px',
    border: '1px solid rgba(74, 222, 128, 0.28)',
    background: 'rgba(2, 6, 23, 0.38)',
    borderRadius: '20px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: '#bbf7d0',
  },
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '18px',
  },
  infoItem: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.7)',
    borderRadius: '16px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  previewBox: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(2, 6, 23, 0.36)',
    borderRadius: '18px',
    padding: '16px',
    marginBottom: '18px',
  },
  smallTitle: {
    color: '#ffffff',
    margin: '0 0 12px',
  },
  previewArticle: {
    borderTop: '1px solid rgba(148, 163, 184, 0.16)',
    paddingTop: '12px',
    marginTop: '12px',
    color: '#e5e7eb',
    lineHeight: 1.9,
  },
  actionsRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  stepsList: {
    color: '#cbd5e1',
    lineHeight: 2.1,
    paddingInlineStart: '22px',
    marginTop: 0,
  },
  typeLegend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '18px',
  },
};
