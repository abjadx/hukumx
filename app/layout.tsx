import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import UnifiedNav from './components/UnifiedNav';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Hukumx | مساعدك القانوني الذكي',
  description:
    'مساعد قانوني عربي مدعوم بالذكاء الاصطناعي لفهم المسائل القانونية وتوجيه المستخدمين بشكل أولي ومنظم.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <UnifiedNav />
        {children}
      </body>
    </html>
  );
}
