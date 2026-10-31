import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileNav } from '@/components/layout/MobileNav';

export const metadata: Metadata = {
  title: 'OpenShelf — Digital Library & PDF Reader',
  description: 'Smart screenshot reading mode, code focus, high-performance reader, and curated technical document library.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Suspense fallback={<div style={{ height: '64px', background: 'var(--bg-secondary)' }} />}>
            <Header />
          </Suspense>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading Workspace...</div>}>
              {children}
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <Footer />
            <MobileNav />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
