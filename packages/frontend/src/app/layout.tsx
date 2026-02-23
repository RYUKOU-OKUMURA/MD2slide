import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MD2slide',
  description: 'Marp互換MarkdownをWebエディタで編集・プレビューし、Google Slides / PDFとしてエクスポートするWebアプリケーション',
  keywords: ['markdown', 'slides', 'presentation', 'marp', 'google slides', 'pdf'],
  authors: [{ name: 'MD2slide Team' }],
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={notoSansJP.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
