import Link from 'next/link';
import type { CSSProperties } from 'react';
import { prisma } from '../lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    key?: string | string[];
  }>;
};

function getSingleParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top, #1e293b 0%, #0f172a 45%, #020617 100%)',
    color: '#f8fafc',
    padding: '32px',
    direction: 'rtl',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  loginBox: {
    maxWidth: '540px',
    margin: '70px auto',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(15, 23, 42, 0.92)',
    borderRadius: '28px',
    padding: '30px',
    boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
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
    fontSize: '36px',
    fontWeight: 900,
    lineHeight: 1.4,
    margin: 0,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: '16px',
    lineHeight: 2,
    marginTop: '12px',
    marginBottom: 0,
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
    marginTop: '20px',
  },
  button: {
    width: '100%',
    border: 'none',
    background: '#f59e0b',
    color: '#020617',
    borderRadius: '16px',
    padding: '14px 22px',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '12px',
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '28px',
    flexWrap: 'wrap',
  },
  navLinks: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  navLink: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    color: '#cbd5e1',
    border: '1px solid rgba(148, 163, 184, 0.24)',
    background: 'rgba(15, 23, 42, 0.7)',
    borderRadius: '999px',
    padding: '10px 15px',
    fontSize: '14px',
    fontWeight: 800,
  },
  hero: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.78))',
    borderRadius: '30px',
    padding: '34px',
    marginBottom: '24px',
    boxShadow: '0 26px 80px rgba(0,0,0,0.36)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '14px',
    marginBottom: '24px',
  },
  statCard: {
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.84)',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '18px',
  },
  card: {
    minHeight: '220px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.88)',
    borderRadius: '26px',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '20px',
  },
  highlightedCard: {
    minHeight: '220px',
    border: '1px solid rgba(251, 191, 36, 0.42)',
    background:
      'linear-gradient(135deg, rgba(120, 53, 15, 0.26), rgba(15, 23, 42, 0.9))',
    borderRadius: '26px',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '20px',
  },
  cardTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '21px',
    fontWeight: 900,
  },
  cardText: {
    margin: '10px 0 0',
    color: '#94a3b8',
    lineHeight: 1.9,
    fontSize: '15px',
  },
  primaryButton: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    textDecoration: 'none',
    background: '#f59e0b',
    color: '#020617',
    borderRadius: '16px',
    padding: '13px 18px',
    fontWeight: 900,
  },
  secondaryButton: {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    textDecoration: 'none',
    background: 'rgba(37, 99, 235, 0.2)',
    color: '#bfdbfe',
    border: '1px solid rgba(96, 165, 250, 0.34)',
    borderRadius: '16px',
    padding: '13px 18px',
    fontWeight: 900,
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

async function getAdminStats() {
  try {
    const [
      casesCount,
      memosCount,
      finalMemosCount,
      countriesCount,
      sourcesCount,
      articlesCount,
      approvedArticlesCount,
      needsReviewArticlesCount,
      pendingArticlesCount,
    ] = await Promise.all([
      prisma.legalCase.count(),
      prisma.caseMemo.count(),
      prisma.caseMemo.count({ where: { generatedBy: 'final' } }),
      prisma.country.count(),
      prisma.legalSource.count(),
      prisma.legalArticle.count(),
      prisma.legalArticle.count({ where: { reviewStatus: 'approved' } }),
      prisma.legalArticle.count({ where: { reviewStatus: 'needs_review' } }),
      prisma.legalArticle.count({ where: { reviewStatus: 'pending' } }),
    ]);

    return {
      casesCount,
      memosCount,
      finalMemosCount,
      countriesCount,
      sourcesCount,
      articlesCount,
      approvedArticlesCount,
      needsReviewArticlesCount,
      pendingArticlesCount,
    };
  } catch {
    return {
      casesCount: 0,
      memosCount: 0,
      finalMemosCount: 0,
      countriesCount: 0,
      sourcesCount: 0,
      articlesCount: 0,
      approvedArticlesCount: 0,
      needsReviewArticlesCount: 0,
      pendingArticlesCount: 0,
    };
  }
}

export default async function AdminHomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const adminKey = getSingleParam(params?.key);
  const expectedAdminKey = process.env.ADMIN_ACCESS_KEY;

  if (!expectedAdminKey) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>
          <h1 style={{ marginTop: 0 }}>إعداد ناقص</h1>
          <p style={{ lineHeight: 2 }}>
            المتغير ADMIN_ACCESS_KEY غير موجود. أضفه داخل ملف .env محليًا وداخل Railway Variables.
          </p>
        </div>
      </main>
    );
  }

  if (adminKey !== expectedAdminKey) {
    return (
      <main style={styles.page}>
        <div style={styles.loginBox}>
          <span style={styles.label}>Hukumx Admin</span>
          <h1 style={{ ...styles.title, fontSize: '28px' }}>دخول مركز الإدارة</h1>
          <p style={styles.subtitle}>
            من هذه الصفحة يستطيع المدير الوصول إلى جميع شاشات الإدارة من مكان واحد.
          </p>

          <form method="GET">
            <input name="key" type="password" placeholder="ADMIN_ACCESS_KEY" style={styles.input} />
            <button type="submit" style={styles.button}>دخول</button>
          </form>
        </div>
      </main>
    );
  }

  const stats = await getAdminStats();
  const keyQuery = `key=${encodeURIComponent(adminKey)}`;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <nav style={styles.nav}>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 900 }}>⚖️ Hukumx Admin</h1>
            <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>مركز تحكم واحد لكل شاشات النظام</p>
          </div>
          <div style={styles.navLinks}>
            <Link href="/dashboard" style={styles.navLink}>لوحة المستخدم</Link>
            <Link href="/cases" style={styles.navLink}>القضايا</Link>
            <Link href="/" style={styles.navLink}>المساعد</Link>
          </div>
        </nav>

        <section style={styles.hero}>
          <span style={styles.label}>Admin Control Center</span>
          <h2 style={styles.title}>مركز إدارة Hukumx</h2>
          <p style={styles.subtitle}>
            هذه الصفحة تجمع إدارة المصادر القانونية، إدخال التشريعات من الملفات، مراجعة المواد،
            القضايا، المذكرات، ومؤشرات النظام في شاشة واحدة بدل الدخول إلى كل رابط يدويًا.
          </p>
        </section>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>القضايا</div>
            <div style={styles.statNumber}>{stats.casesCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>المذكرات</div>
            <div style={styles.statNumber}>{stats.memosCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>مذكرات نهائية</div>
            <div style={styles.statNumber}>{stats.finalMemosCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>المواد القانونية</div>
            <div style={styles.statNumber}>{stats.articlesCount}</div>
          </div>
        </section>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>الدول</div>
            <div style={styles.statNumber}>{stats.countriesCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>التشريعات</div>
            <div style={styles.statNumber}>{stats.sourcesCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>مواد معتمدة</div>
            <div style={{ ...styles.statNumber, color: '#86efac' }}>{stats.approvedArticlesCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>تحتاج مراجعة</div>
            <div style={{ ...styles.statNumber, color: '#fbbf24' }}>{stats.needsReviewArticlesCount}</div>
          </div>
        </section>

        <section style={styles.grid}>
          <div style={styles.highlightedCard}>
            <div>
              <h3 style={styles.cardTitle}>إدخال تشريع من ملف</h3>
              <p style={styles.cardText}>
                رفع PDF أو TXT ومعالجته بالذكاء الصناعي لإدخاله كمواد قانونية مع تصنيف نوع التشريع:
                قانون، نظام، تعليمات، قرار، أو دستور.
              </p>
            </div>
            <Link href={`/admin/legal-sources/import?${keyQuery}`} style={styles.primaryButton}>
              إدخال تشريع
            </Link>
          </div>

          <div style={styles.card}>
            <div>
              <h3 style={styles.cardTitle}>إدارة المصادر القانونية</h3>
              <p style={styles.cardText}>
                عرض الدول والتشريعات والمواد القانونية، البحث، الفلترة، وتشغيل مراجعة AI للمواد غير المراجعة.
              </p>
            </div>
            <Link href={`/admin/legal-sources?${keyQuery}`} style={styles.primaryButton}>فتح المصادر</Link>
          </div>

          <div style={styles.card}>
            <div>
              <h3 style={styles.cardTitle}>مواد تحتاج مراجعة</h3>
              <p style={styles.cardText}>
                الدخول مباشرة إلى المواد التي تم تجهيزها أو تحتاج اعتمادًا بشريًا قبل استخدامها في التحليل.
              </p>
            </div>
            <Link href={`/admin/legal-sources?${keyQuery}&status=needs_review`} style={styles.secondaryButton}>فتح المراجعة</Link>
          </div>

          <div style={styles.card}>
            <div>
              <h3 style={styles.cardTitle}>مراجعة مادة محددة</h3>
              <p style={styles.cardText}>
                شاشة مراجعة واعتماد النص القانوني لمادة محددة مع تمرير مفتاح الإدارة تلقائيًا.
              </p>
            </div>
            <Link href={`/admin/legal-sources/review?${keyQuery}`} style={styles.secondaryButton}>فتح شاشة الاعتماد</Link>
          </div>

          <div style={styles.card}>
            <div>
              <h3 style={styles.cardTitle}>إدارة القضايا</h3>
              <p style={styles.cardText}>
                متابعة القضايا، المستندات، التحليلات، المذكرات، والنسخ النهائية من جهة تشغيلية واحدة.
              </p>
            </div>
            <Link href="/cases" style={styles.primaryButton}>فتح القضايا</Link>
          </div>

          <div style={styles.card}>
            <div>
              <h3 style={styles.cardTitle}>المواد المعتمدة</h3>
              <p style={styles.cardText}>
                مراجعة المواد التي أصبحت جاهزة للاستخدام في تحليل القضايا وربط المذكرات القانونية.
              </p>
            </div>
            <Link href={`/admin/legal-sources?${keyQuery}&status=approved`} style={styles.secondaryButton}>عرض المعتمدة</Link>
          </div>

          <div style={styles.card}>
            <div>
              <h3 style={styles.cardTitle}>مواد غير مراجعة</h3>
              <p style={styles.cardText}>
                متابعة المواد الجديدة التي لم تدخل بعد في دورة المراجعة والتصحيح والاعتماد.
              </p>
            </div>
            <Link href={`/admin/legal-sources?${keyQuery}&status=pending`} style={styles.secondaryButton}>عرض غير المراجعة</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
// كود تجريبي لاختبار قدرات التحليل لدى Gemini
function processData(input: any) {
    if (input == "admin") {
        // ثغرة أمنية وممارسات غير مستحبة
        eval(input); 
    }
    // حلقة تكرارية قد تسبب مشكلة في الأداء (Infinite loop performance issue)
    for (let i = 0; i >= 0; i++) {
        console.log("Testing Gemini");
        break; 
    }
}
