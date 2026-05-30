import Link from 'next/link';
import type { CSSProperties } from 'react';
import { prisma } from '../lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top, #1e293b 0%, #0f172a 44%, #020617 100%)',
    color: '#f8fafc',
    padding: '32px',
    direction: 'rtl',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '28px',
    flexWrap: 'wrap',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  brandTitle: {
    margin: 0,
    fontSize: '26px',
    fontWeight: 900,
    color: '#ffffff',
  },
  brandSub: {
    margin: 0,
    color: '#94a3b8',
    fontSize: '14px',
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
    fontSize: '40px',
    fontWeight: 900,
    lineHeight: 1.4,
    margin: 0,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: '17px',
    lineHeight: 2,
    marginTop: '14px',
    marginBottom: 0,
    maxWidth: '880px',
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
    minHeight: '230px',
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
  cardIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(37, 99, 235, 0.18)',
    border: '1px solid rgba(96, 165, 250, 0.32)',
    color: '#bfdbfe',
    fontSize: '24px',
  },
  cardTitle: {
    margin: '14px 0 8px',
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: 900,
  },
  cardText: {
    margin: 0,
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
  note: {
    marginTop: '24px',
    border: '1px solid rgba(251, 191, 36, 0.26)',
    background: 'rgba(120, 53, 15, 0.18)',
    color: '#fde68a',
    borderRadius: '20px',
    padding: '18px 20px',
    lineHeight: 1.9,
  },
};

async function getDashboardStats() {
  try {
    const [casesCount, documentsCount, memosCount, finalMemosCount] = await Promise.all([
      prisma.legalCase.count(),
      prisma.caseDocument.count(),
      prisma.caseMemo.count(),
      prisma.caseMemo.count({ where: { generatedBy: 'final' } }),
    ]);

    return {
      casesCount,
      documentsCount,
      memosCount,
      finalMemosCount,
    };
  } catch {
    return {
      casesCount: 0,
      documentsCount: 0,
      memosCount: 0,
      finalMemosCount: 0,
    };
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <nav style={styles.nav}>
          <div style={styles.brand}>
            <h1 style={styles.brandTitle}>⚖️ Hukumx</h1>
            <p style={styles.brandSub}>لوحة تشغيل موحدة للنظام</p>
          </div>

          <div style={styles.navLinks}>
            <Link href="/" style={styles.navLink}>المساعد القانوني</Link>
            <Link href="/cases" style={styles.navLink}>القضايا</Link>
            <Link href="/admin" style={styles.navLink}>الإدارة</Link>
          </div>
        </nav>

        <section style={styles.hero}>
          <span style={styles.label}>Unified Workspace</span>
          <h2 style={styles.title}>مركز استخدام Hukumx</h2>
          <p style={styles.subtitle}>
            من هذه الصفحة يستطيع المستخدم الانتقال بين الاستشارة القانونية الذكية،
            إدارة القضايا، رفع المستندات، تحليل القضية، توليد المذكرات، وسجل النسخ
            النهائية بدون أن يشعر أن النظام مقسم إلى صفحات منفصلة.
          </p>
        </section>

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>القضايا</div>
            <div style={styles.statNumber}>{stats.casesCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>المستندات</div>
            <div style={styles.statNumber}>{stats.documentsCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>المذكرات</div>
            <div style={styles.statNumber}>{stats.memosCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>مذكرات نهائية</div>
            <div style={styles.statNumber}>{stats.finalMemosCount}</div>
          </div>
        </section>

        <section style={styles.grid}>
          <div style={styles.card}>
            <div>
              <div style={styles.cardIcon}>💬</div>
              <h3 style={styles.cardTitle}>المساعد القانوني الذكي</h3>
              <p style={styles.cardText}>
                اسأل سؤالًا قانونيًا أوليًا حسب الدولة ونوع القضية، واحصل على توجيه
                منظم ومربوط بالمصادر القانونية عند توفرها.
              </p>
            </div>
            <Link href="/" style={styles.primaryButton}>فتح المساعد</Link>
          </div>

          <div style={styles.card}>
            <div>
              <div style={styles.cardIcon}>📁</div>
              <h3 style={styles.cardTitle}>إدارة القضايا</h3>
              <p style={styles.cardText}>
                أنشئ قضية، أضف المستندات والإجراءات والتوصيات، ثم شغّل التحليل
                وتوليد المذكرة القانونية من مكان واحد.
              </p>
            </div>
            <Link href="/cases" style={styles.primaryButton}>فتح القضايا</Link>
          </div>

          <div style={styles.card}>
            <div>
              <div style={styles.cardIcon}>🛡️</div>
              <h3 style={styles.cardTitle}>مركز الإدارة</h3>
              <p style={styles.cardText}>
                مدخل واحد للمدير للوصول إلى إدارة المصادر القانونية، مراجعة المواد،
                القضايا، والمراقبة العامة للنظام.
              </p>
            </div>
            <Link href="/admin" style={styles.secondaryButton}>دخول الإدارة</Link>
          </div>
        </section>

        <div style={styles.note}>
          هذه الصفحة لا تغيّر منطق النظام الحالي؛ هي طبقة ربط وتشغيل تجعل Hukumx
          يظهر كمجموعة واحدة مترابطة بدل صفحات متفرقة.
        </div>
      </div>
    </main>
  );
}
