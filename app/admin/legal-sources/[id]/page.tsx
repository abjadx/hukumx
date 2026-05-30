import Link from 'next/link';
import type { CSSProperties } from 'react';
import { prisma } from '../../../lib/prisma';
import DeleteLegalSourceButton from '../../../components/DeleteLegalSourceButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  params?: Promise<{
    id?: string;
  }>;
  searchParams?: Promise<{
    key?: string | string[];
    q?: string | string[];
    status?: string | string[];
  }>;
};

type SourceArticle = {
  id: string;
  articleNumber: string;
  articleText: string;
  articleTextClean: string | null;
  articleTextReviewed: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  updatedAt: Date;
};

function getSingleParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function convertArabicDigits(value: string) {
  const map: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  };

  return value.replace(/[٠-٩]/g, (digit) => map[digit] || digit);
}

function getArticleNumberValue(value: string) {
  const normalized = convertArabicDigits(value)
    .replace(/^المادة\s*/u, '')
    .replace(/^مادة\s*/u, '')
    .replace(/[^0-9.\-]/g, '')
    .trim();

  const directNumber = Number(normalized);
  if (Number.isFinite(directNumber)) return directNumber;

  const firstNumber = Number(normalized.match(/\d+/)?.[0] || '');
  return Number.isFinite(firstNumber) ? firstNumber : Number.MAX_SAFE_INTEGER;
}

function compareArticleNumbers(a: string, b: string) {
  const numberA = getArticleNumberValue(a);
  const numberB = getArticleNumberValue(b);

  if (numberA !== numberB) return numberA - numberB;
  return a.localeCompare(b, 'ar', { numeric: true });
}

function getBestArticleText(article: SourceArticle) {
  if (
    article.reviewStatus === 'approved' &&
    article.articleTextReviewed &&
    article.articleTextReviewed.trim()
  ) {
    return article.articleTextReviewed;
  }

  return article.articleTextReviewed || article.articleTextClean || article.articleText;
}

function trimText(value: string, maxLength = 360) {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
}

function getStatusLabel(status: string) {
  if (status === 'approved') return 'معتمدة';
  if (status === 'needs_review') return 'تحتاج مراجعة';
  if (status === 'pending') return 'غير مراجعة';
  return status || 'غير مراجعة';
}

function getSafeStatusFilter(value: string) {
  if (value === 'approved') return 'approved';
  if (value === 'needs_review') return 'needs_review';
  if (value === 'pending') return 'pending';
  return 'all';
}

function getSourceTypeLabel(value?: string | null) {
  if (value === 'CONSTITUTION') return 'دستور';
  if (value === 'LAW') return 'قانون';
  if (value === 'REGULATION') return 'نظام';
  if (value === 'INSTRUCTIONS') return 'تعليمات';
  if (value === 'DECISION') return 'قرار';
  return value || 'غير محدد';
}

function formatDate(value?: Date | string | null) {
  if (!value) return 'غير محدد';

  try {
    return new Intl.DateTimeFormat('ar-JO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top, #1e293b 0%, #0f172a 42%, #020617 100%)',
    color: '#f8fafc',
    padding: '32px',
    direction: 'rtl',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  hero: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.78))',
    borderRadius: '30px',
    padding: '30px',
    marginBottom: '24px',
    boxShadow: '0 26px 80px rgba(0,0,0,0.36)',
  },
  topActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '18px',
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
    color: '#ffffff',
    fontSize: '34px',
    fontWeight: 900,
    lineHeight: 1.5,
    margin: 0,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: '16px',
    lineHeight: 2,
    marginTop: '12px',
    marginBottom: 0,
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    background: 'rgba(15, 23, 42, 0.78)',
    color: '#e2e8f0',
    borderRadius: '14px',
    padding: '11px 15px',
    fontSize: '14px',
    fontWeight: 900,
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    border: 'none',
    background: '#f59e0b',
    color: '#020617',
    borderRadius: '14px',
    padding: '11px 15px',
    fontSize: '14px',
    fontWeight: 900,
  },
  dangerButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(248, 113, 113, 0.42)',
    background: 'rgba(127, 29, 29, 0.34)',
    color: '#fecaca',
    borderRadius: '14px',
    padding: '11px 15px',
    fontSize: '14px',
    fontWeight: 900,
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '14px',
    marginBottom: '24px',
  },
  statCard: {
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.86)',
    borderRadius: '22px',
    padding: '20px',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: '14px',
    marginBottom: '10px',
  },
  statNumber: {
    color: '#ffffff',
    fontSize: '32px',
    fontWeight: 900,
  },
  section: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(15, 23, 42, 0.88)',
    borderRadius: '28px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 18px 50px rgba(0,0,0,0.24)',
  },
  formRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  input: {
    flex: 1,
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(2, 6, 23, 0.72)',
    color: '#f8fafc',
    borderRadius: '16px',
    padding: '14px 16px',
    outline: 'none',
    fontSize: '14px',
  },
  select: {
    flex: '0 0 220px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(2, 6, 23, 0.72)',
    color: '#f8fafc',
    borderRadius: '16px',
    padding: '14px 16px',
    outline: 'none',
    fontSize: '14px',
  },
  articleCard: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(2, 6, 23, 0.56)',
    borderRadius: '22px',
    padding: '20px',
    marginBottom: '14px',
  },
  articleHeader: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  articleNumber: {
    border: '1px solid rgba(245, 158, 11, 0.55)',
    background: 'rgba(245, 158, 11, 0.12)',
    color: '#fbbf24',
    borderRadius: '999px',
    padding: '7px 14px',
    fontSize: '14px',
    fontWeight: 900,
  },
  statusBadge: {
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.75)',
    color: '#cbd5e1',
    borderRadius: '999px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 900,
  },
  approvedBadge: {
    border: '1px solid rgba(34, 197, 94, 0.45)',
    background: 'rgba(34, 197, 94, 0.12)',
    color: '#86efac',
    borderRadius: '999px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 900,
  },
  articleText: {
    color: '#e2e8f0',
    fontSize: '15px',
    lineHeight: 2,
    margin: 0,
    whiteSpace: 'pre-line',
  },
  errorBox: {
    maxWidth: '720px',
    margin: '70px auto',
    border: '1px solid rgba(248, 113, 113, 0.5)',
    background: 'rgba(127, 29, 29, 0.25)',
    borderRadius: '26px',
    padding: '28px',
    color: '#fecaca',
  },
};

export default async function LegalSourceDetailsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const sourceId = resolvedParams?.id || '';
  const adminKey = getSingleParam(resolvedSearchParams?.key);
  const query = getSingleParam(resolvedSearchParams?.q).trim();
  const statusFilter = getSafeStatusFilter(getSingleParam(resolvedSearchParams?.status).trim());

  const expectedAdminKey = process.env.ADMIN_ACCESS_KEY;

  if (!expectedAdminKey || adminKey !== expectedAdminKey) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>
          <h1 style={{ marginTop: 0 }}>غير مصرح</h1>
          <p style={{ lineHeight: 2 }}>يرجى الدخول من مركز الإدارة باستخدام مفتاح الإدارة الصحيح.</p>
          <Link href="/admin" style={styles.primaryButton}>العودة إلى مركز الإدارة</Link>
        </div>
      </main>
    );
  }

  const source = await prisma.legalSource.findUnique({
    where: { id: sourceId },
    include: {
      country: true,
      articles: true,
    },
  });

  if (!source) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>
          <h1 style={{ marginTop: 0 }}>التشريع غير موجود</h1>
          <p style={{ lineHeight: 2 }}>لم يتم العثور على التشريع المطلوب أو تم حذفه.</p>
          <Link href={`/admin/legal-sources?key=${encodeURIComponent(adminKey)}`} style={styles.primaryButton}>
            العودة إلى المصادر القانونية
          </Link>
        </div>
      </main>
    );
  }

  const allArticles = source.articles as SourceArticle[];
  const approvedCount = allArticles.filter((article) => article.reviewStatus === 'approved').length;
  const needsReviewCount = allArticles.filter((article) => article.reviewStatus === 'needs_review').length;
  const pendingCount = allArticles.filter((article) => article.reviewStatus === 'pending').length;

  const filteredArticles = allArticles
    .filter((article) => {
      if (statusFilter !== 'all' && article.reviewStatus !== statusFilter) return false;

      if (!query) return true;

      const text = `${article.articleNumber} ${article.articleText} ${article.articleTextClean || ''} ${
        article.articleTextReviewed || ''
      }`;

      return text.toLowerCase().includes(query.toLowerCase());
    })
    .sort((a, b) => compareArticleNumbers(a.articleNumber, b.articleNumber));

  const keyQuery = `key=${encodeURIComponent(adminKey)}`;
  const reimportHref =
    `/admin/legal-sources/import?${keyQuery}` +
    `&countryCode=${encodeURIComponent(source.country.code)}` +
    `&titleAr=${encodeURIComponent(source.titleAr)}` +
    `&titleEn=${encodeURIComponent(source.titleEn || '')}` +
    `&legislationType=${encodeURIComponent(source.category || 'LAW')}` +
    `&slug=${encodeURIComponent(source.slug)}` +
    `&expectedArticleCount=${encodeURIComponent(String(allArticles.length || ''))}` +
    '&replaceExisting=true';

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topActions}>
          <Link href={`/admin?${keyQuery}`} style={styles.button}>مركز الإدارة</Link>
          <Link href={`/admin/legal-sources?${keyQuery}`} style={styles.button}>كل التشريعات</Link>
          <Link href={`/admin/legal-sources/import?${keyQuery}`} style={styles.primaryButton}>إدخال تشريع جديد</Link>
          <Link href={reimportHref} style={styles.primaryButton}>إعادة إدخال هذا التشريع</Link>
          <DeleteLegalSourceButton
            sourceId={source.id}
            adminKey={adminKey}
            sourceTitle={source.titleAr}
            style={styles.dangerButton}
          />
        </div>

        <section style={styles.hero}>
          <span style={styles.label}>{getSourceTypeLabel(source.category)}</span>
          <h1 style={styles.title}>{source.titleAr}</h1>
          <p style={styles.subtitle}>
            {source.country.nameAr} — Slug: {source.slug}
            {source.fileName ? ` — الملف: ${source.fileName}` : ''}
          </p>
        </section>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>عدد المواد</div>
            <div style={styles.statNumber}>{allArticles.length}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>معتمدة</div>
            <div style={{ ...styles.statNumber, color: '#86efac' }}>{approvedCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>تحتاج مراجعة</div>
            <div style={{ ...styles.statNumber, color: '#fbbf24' }}>{needsReviewCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>غير مراجعة</div>
            <div style={{ ...styles.statNumber, color: '#fecaca' }}>{pendingCount}</div>
          </div>
        </section>

        <section style={styles.section}>
          <form method="GET" style={styles.formRow}>
            <input name="key" type="hidden" value={adminKey} />
            <input
              name="q"
              defaultValue={query}
              placeholder="ابحث داخل هذا التشريع برقم المادة أو النص..."
              style={styles.input}
            />
            <select name="status" defaultValue={statusFilter} style={styles.select}>
              <option value="all">كل المواد</option>
              <option value="approved">مواد معتمدة</option>
              <option value="needs_review">تحتاج مراجعة</option>
              <option value="pending">غير مراجعة</option>
            </select>
            <button type="submit" style={styles.primaryButton}>بحث</button>
          </form>

          {filteredArticles.map((article) => {
            const fullText = getBestArticleText(article);
            const reviewHref = `/admin/legal-sources/review?${keyQuery}&article=${encodeURIComponent(
              article.articleNumber
            )}`;

            return (
              <article key={article.id} style={styles.articleCard}>
                <div style={styles.articleHeader}>
                  <span style={styles.articleNumber}>المادة {article.articleNumber}</span>
                  {article.reviewStatus === 'approved' && <span style={styles.approvedBadge}>نص معتمد</span>}
                  <span style={styles.statusBadge}>{getStatusLabel(article.reviewStatus)}</span>
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                    آخر تحديث: {formatDate(article.updatedAt)}
                  </span>
                  <Link href={reviewHref} style={{ ...styles.button, marginInlineStart: 'auto' }}>
                    مراجعة المادة
                  </Link>
                </div>

                <p style={styles.articleText}>{trimText(fullText)}</p>

                <details
                  style={{
                    marginTop: '14px',
                    borderTop: '1px solid rgba(148, 163, 184, 0.16)',
                    paddingTop: '14px',
                  }}
                >
                  <summary
                    style={{
                      cursor: 'pointer',
                      color: '#fbbf24',
                      fontWeight: 900,
                      fontSize: '14px',
                      marginBottom: '12px',
                    }}
                  >
                    عرض المادة كاملة
                  </summary>
                  <p style={{ ...styles.articleText, marginTop: '12px' }}>{fullText}</p>
                  {article.reviewNotes && (
                    <p style={{ color: '#94a3b8', lineHeight: 1.9, marginTop: '16px', whiteSpace: 'pre-line' }}>
                      ملاحظات المراجعة:\n{article.reviewNotes}
                    </p>
                  )}
                </details>
              </article>
            );
          })}

          {filteredArticles.length === 0 && (
            <div style={{ ...styles.articleCard, textAlign: 'center', color: '#94a3b8' }}>
              لا توجد مواد مطابقة داخل هذا التشريع.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
