import type { CSSProperties } from 'react';
import { prisma } from '../../lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    key?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
};

type AdminSource = {
  id: string;
  titleAr: string;
  slug: string;
  isActive: boolean;
  country: {
    nameAr: string;
  };
  _count: {
    articles: number;
  };
};

type AdminArticle = {
  id: string;
  articleNumber: string;
  articleText: string;
  articleTextClean: string | null;
  articleTextReviewed: string | null;
  reviewStatus: string;
  legalSource: {
    titleAr: string;
    country: {
      nameAr: string;
    };
  };
};

function getSingleParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function trimText(value: string, maxLength = 220) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function formatArticleTextForAdmin(value: string) {
  const normalizedText = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')

    // تصحيح أخطاء OCR شائعة في العربية
    .replace(/إال/g, 'إلا')
    .replace(/اإل/g, 'الإ')
    .replace(/األ/g, 'الأ')
    .replace(/اآل/g, 'الا')
    .replace(/اال/g, 'الا')
    .replace(/اآ/g, 'الا')
    .replace(/استالم/g, 'استلام')
    .replace(/بالاستالم/g, 'بالاستلام')
    .replace(/(^|[\s\n،؛.:()[\]{}-])كال(?=\s|[،؛.:])/g, '$1كلا')

    // تصحيح "لا" إذا ظهرت مقلوبة ككلمة مستقلة
    .replace(/(^|[\s\n،؛.:()[\]{}-])ال(?=\s)/g, '$1لا')

    // تصحيح "ولا" إذا ظهرت مقلوبة ككلمة مستقلة
    .replace(/(^|[\s\n،؛.:()[\]{}-])وال(?=\s)/g, '$1ولا')
    .trim();

  const lines = normalizedText
  .split('\n')
  .map((line) =>
    line
      .trim()

      // تحويل -1 أو 1- إلى 1. لتجنب ظهور الشرطة قبل الرقم في RTL
      .replace(/^\s*[-–]\s*(\d+)\s*[-–.]?\s*/, '$1. ')
      .replace(/^\s*(\d+)\s*[-–]\s*/, '$1. ')

      // ترتيب الفقرات الحرفية فقط إذا كانت مكتوبة صراحة مثل: أ) أو (أ)
      .replace(
        /^\s*\(?\s*([أابجدهوزحطيكلمنسعفصقرشتثخذضظغ])\s*\)\s*/,
        '($1) '
      )
  )
  .filter(Boolean);

  const paragraphs: string[] = [];
  let currentParagraph = '';

  for (const line of lines) {
    const isListItem =
      /^[-–•]/.test(line) ||
      /^\d+\s*[\.\-)]/.test(line) ||
      /^\([أابجدهوزحطيكلمنسعفصقرشتثخذضظغ]\)/.test(line);

    if (isListItem) {
      if (currentParagraph) {
        paragraphs.push(currentParagraph);
      }

      currentParagraph = line;
      continue;
    }

    currentParagraph = currentParagraph
      ? `${currentParagraph} ${line}`
      : line;
  }

  if (currentParagraph) {
    paragraphs.push(currentParagraph);
  }

  return paragraphs.join('\n');
}

function getBestAdminArticleText(article: AdminArticle) {
  if (
    article.reviewStatus === 'approved' &&
    article.articleTextReviewed &&
    article.articleTextReviewed.trim()
  ) {
    return article.articleTextReviewed;
  }

  return article.articleTextClean || article.articleText;
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
    background: 'rgba(15, 23, 42, 0.82)',
    borderRadius: '28px',
    padding: '28px',
    marginBottom: '24px',
    boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
  },
  label: {
    color: '#fbbf24',
    fontSize: '14px',
    fontWeight: 800,
    marginBottom: '10px',
  },
  title: {
    color: '#ffffff',
    fontSize: '34px',
    fontWeight: 900,
    margin: 0,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: '16px',
    lineHeight: 2,
    marginTop: '14px',
    marginBottom: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(15, 23, 42, 0.88)',
    borderRadius: '22px',
    padding: '22px',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: '14px',
    marginBottom: '12px',
  },
  statNumber: {
    color: '#fbbf24',
    fontSize: '34px',
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
  sectionTitle: {
    color: '#fbbf24',
    fontSize: '22px',
    fontWeight: 900,
    margin: '0 0 20px 0',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '760px',
  },
  th: {
    color: '#cbd5e1',
    fontSize: '14px',
    textAlign: 'right',
    padding: '14px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
  },
  td: {
    color: '#f8fafc',
    fontSize: '14px',
    padding: '14px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    padding: '6px 12px',
    border: '1px solid rgba(34, 197, 94, 0.45)',
    background: 'rgba(34, 197, 94, 0.12)',
    color: '#86efac',
    fontSize: '12px',
    fontWeight: 800,
  },
  formRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
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
  button: {
    border: 'none',
    background: '#f59e0b',
    color: '#020617',
    borderRadius: '16px',
    padding: '14px 22px',
    fontWeight: 900,
    cursor: 'pointer',
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
    articleActions: {
    marginInlineStart: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  reviewButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(96, 165, 250, 0.45)',
    background: 'rgba(37, 99, 235, 0.18)',
    color: '#bfdbfe',
    borderRadius: '999px',
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: 900,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
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
  articleSource: {
    color: '#94a3b8',
    fontSize: '14px',
  },
  articleText: {
    color: '#e2e8f0',
    fontSize: '15px',
    lineHeight: 2,
    margin: 0,
  },
  loginBox: {
    maxWidth: '520px',
    margin: '70px auto',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(15, 23, 42, 0.9)',
    borderRadius: '26px',
    padding: '28px',
    boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
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

export default async function LegalSourcesAdminPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const adminKey = getSingleParam(params?.key);
  const query = getSingleParam(params?.q).trim();

  const pageParam = Number(getSingleParam(params?.page) || '1');
  const currentPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSize = 25;

  const expectedAdminKey = process.env.ADMIN_ACCESS_KEY;

  if (!expectedAdminKey) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>
          <h1 style={{ marginTop: 0 }}>إعداد ناقص</h1>
          <p style={{ lineHeight: 2 }}>
            المتغير ADMIN_ACCESS_KEY غير موجود. أضفه داخل ملف .env محليًا وداخل
            Railway Variables.
          </p>
        </div>
      </main>
    );
  }

  if (adminKey !== expectedAdminKey) {
    return (
      <main style={styles.page}>
        <div style={styles.loginBox}>
          <p style={styles.label}>Hukumx Admin</p>
          <h1 style={{ ...styles.title, fontSize: '26px' }}>
            دخول إدارة المصادر القانونية
          </h1>

          <p style={styles.subtitle}>
            هذه الصفحة داخلية. أدخل مفتاح الإدارة للمتابعة.
          </p>

          <form method="GET" style={{ marginTop: '22px' }}>
            <input
              name="key"
              type="password"
              placeholder="ADMIN_ACCESS_KEY"
              style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}
            />

            <button
              type="submit"
              style={{ ...styles.button, width: '100%', marginTop: '12px' }}
            >
              دخول
            </button>
          </form>
        </div>
      </main>
    );
  }

  const [
    countriesCount,
    sourcesCount,
    articlesCount,
    sourcesRaw,
    allArticlesRaw,
  ] = await Promise.all([
    prisma.country.count(),
    prisma.legalSource.count(),
    prisma.legalArticle.count(),
    prisma.legalSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        country: true,
        _count: {
          select: {
            articles: true,
          },
        },
      },
    }),
    prisma.legalArticle.findMany({
      where: query
        ? {
            OR: [
              { articleNumber: { contains: query } },
              { articleText: { contains: query, mode: 'insensitive' } },
              { articleTextClean: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        legalSource: {
          include: {
            country: true,
          },
        },
      },
    }),
  ]);

  const sources = sourcesRaw as AdminSource[];
  const allArticles = allArticlesRaw as AdminArticle[];

  const sortedArticles = [...allArticles].sort(
    (a: AdminArticle, b: AdminArticle) => {
      const numberA = Number(a.articleNumber);
      const numberB = Number(b.articleNumber);

      if (Number.isFinite(numberA) && Number.isFinite(numberB)) {
        return numberA - numberB;
      }

      return a.articleNumber.localeCompare(b.articleNumber, 'ar');
    }
  );

  const filteredArticlesCount = sortedArticles.length;
  const totalPages = Math.max(1, Math.ceil(filteredArticlesCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const articles = sortedArticles.slice(startIndex, startIndex + pageSize);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.hero}>
          <p style={styles.label}>Hukumx Admin</p>
          <h1 style={styles.title}>إدارة المصادر القانونية</h1>
          <p style={styles.subtitle}>
            هذه نسخة قراءة فقط لعرض الدول والقوانين والمواد القانونية الموجودة
            داخل قاعدة البيانات.
          </p>
        </section>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>الدول</div>
            <div style={styles.statNumber}>{countriesCount}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>القوانين</div>
            <div style={styles.statNumber}>{sourcesCount}</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>المواد القانونية</div>
            <div style={styles.statNumber}>{articlesCount}</div>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>القوانين الموجودة</h2>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>الدولة</th>
                  <th style={styles.th}>اسم القانون</th>
                  <th style={styles.th}>Slug</th>
                  <th style={styles.th}>عدد المواد</th>
                  <th style={styles.th}>الحالة</th>
                </tr>
              </thead>

              <tbody>
                {sources.map((source: AdminSource) => (
                  <tr key={source.id}>
                    <td style={styles.td}>{source.country.nameAr}</td>
                    <td style={{ ...styles.td, fontWeight: 900 }}>
                      {source.titleAr}
                    </td>
                    <td style={{ ...styles.td, color: '#94a3b8' }}>
                      {source.slug}
                    </td>
                    <td style={styles.td}>{source._count.articles}</td>
                    <td style={styles.td}>
                      <span style={styles.badge}>
                        {source.isActive ? 'فعال' : 'غير فعال'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>المواد القانونية</h2>

          <form method="GET" style={styles.formRow}>
            <input name="key" type="hidden" value={adminKey} />
            <input name="page" type="hidden" value="1" />

            <input
              name="q"
              defaultValue={query}
              placeholder="ابحث برقم المادة أو النص..."
              style={styles.input}
            />

            <button type="submit" style={styles.button}>
              بحث
            </button>
          </form>

          <div>
            {articles.map((article: AdminArticle) => {
  const fullArticleText = formatArticleTextForAdmin(
    getBestAdminArticleText(article)
  );

  const reviewHref = `/admin/legal-sources/review?key=${encodeURIComponent(
    adminKey
  )}&article=${encodeURIComponent(article.articleNumber)}`;

  return (
    <article key={article.id} style={styles.articleCard}>
      <div style={styles.articleHeader}>
        <span style={styles.articleNumber}>
          المادة {article.articleNumber}
        </span>

        <span style={styles.articleSource}>
          {article.legalSource.country.nameAr} —{' '}
          {article.legalSource.titleAr}
        </span>

        <div style={styles.articleActions}>
          {article.reviewStatus === 'approved' && (
            <span
              style={{
                border: '1px solid rgba(34, 197, 94, 0.45)',
                background: 'rgba(34, 197, 94, 0.12)',
                color: '#86efac',
                borderRadius: '999px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 900,
              }}
            >
              نص معتمد
            </span>
          )}

          <a href={reviewHref} style={styles.reviewButton}>
            مراجعة المادة
          </a>
        </div>
      </div>

      <p style={styles.articleText}>{trimText(fullArticleText)}</p>

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

        <p
          style={{
            color: '#f8fafc',
            fontSize: '15px',
            lineHeight: 2.1,
            whiteSpace: 'pre-line',
            margin: '12px 0 0 0',
          }}
        >
          {fullArticleText}
        </p>
      </details>
    </article>
  );
})}

            {articles.length === 0 && (
              <div
                style={{
                  ...styles.articleCard,
                  textAlign: 'center',
                  color: '#94a3b8',
                }}
              >
                لا توجد نتائج مطابقة.
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginTop: '22px',
              borderTop: '1px solid rgba(148, 163, 184, 0.16)',
              paddingTop: '18px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ color: '#94a3b8', fontSize: '14px' }}>
              عرض {articles.length} من أصل {filteredArticlesCount} مادة — الصفحة{' '}
              {safeCurrentPage} من {totalPages}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {safeCurrentPage > 1 && (
                <a
                  href={`/admin/legal-sources?key=${encodeURIComponent(
                    adminKey
                  )}&q=${encodeURIComponent(query)}&page=${
                    safeCurrentPage - 1
                  }`}
                  style={{
                    ...styles.button,
                    textDecoration: 'none',
                    background: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                  }}
                >
                  السابق
                </a>
              )}

              {safeCurrentPage < totalPages && (
                <a
                  href={`/admin/legal-sources?key=${encodeURIComponent(
                    adminKey
                  )}&q=${encodeURIComponent(query)}&page=${
                    safeCurrentPage + 1
                  }`}
                  style={{
                    ...styles.button,
                    textDecoration: 'none',
                  }}
                >
                  التالي
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}