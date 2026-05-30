'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';

type NavItem = {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'مركز الاستخدام',
    match: (pathname) => pathname === '/dashboard',
  },
  {
    href: '/',
    label: 'المساعد القانوني',
    match: (pathname) => pathname === '/',
  },
  {
    href: '/cases',
    label: 'القضايا',
    match: (pathname) => pathname === '/cases' || pathname.startsWith('/cases/'),
  },
  {
    href: '/admin',
    label: 'الإدارة',
    match: (pathname) => pathname === '/admin' || pathname.startsWith('/admin/'),
  },
];

export default function UnifiedNav() {
  const pathname = usePathname() || '/';

  return (
    <header style={styles.wrapper} dir="rtl">
      <div style={styles.inner}>
        <Link href="/dashboard" style={styles.brandLink}>
          <span style={styles.brandIcon}>⚖️</span>
          <span style={styles.brandText}>Hukumx</span>
          <span style={styles.brandArabic}>حكمx</span>
        </Link>

        <nav style={styles.nav} aria-label="Hukumx unified navigation">
          {navItems.map((item) => {
            const isActive = item.match ? item.match(pathname) : pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...styles.navLink,
                  ...(isActive ? styles.activeNavLink : {}),
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    background: 'rgba(2, 6, 23, 0.92)',
    backdropFilter: 'blur(18px)',
    borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
    boxShadow: '0 10px 34px rgba(0, 0, 0, 0.24)',
  },
  inner: {
    width: 'min(1560px, calc(100% - 32px))',
    margin: '0 auto',
    minHeight: '68px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '18px',
    flexWrap: 'wrap',
    padding: '10px 0',
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  brandLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    color: '#ffffff',
    textDecoration: 'none',
    fontWeight: 900,
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
  },
  brandIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '38px',
    borderRadius: '14px',
    background: 'rgba(245, 158, 11, 0.16)',
    border: '1px solid rgba(251, 191, 36, 0.35)',
  },
  brandText: {
    fontSize: '22px',
    color: '#ffffff',
  },
  brandArabic: {
    fontSize: '15px',
    color: '#fbbf24',
    border: '1px solid rgba(251, 191, 36, 0.24)',
    borderRadius: '999px',
    padding: '5px 10px',
    background: 'rgba(245, 158, 11, 0.09)',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap',
  },
  navLink: {
    color: '#cbd5e1',
    textDecoration: 'none',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(15, 23, 42, 0.72)',
    borderRadius: '999px',
    padding: '9px 14px',
    fontSize: '14px',
    fontWeight: 800,
    transition: 'all 160ms ease',
    whiteSpace: 'nowrap',
  },
  activeNavLink: {
    color: '#020617',
    background: '#fbbf24',
    border: '1px solid #fbbf24',
    boxShadow: '0 10px 26px rgba(245, 158, 11, 0.2)',
  },
};
