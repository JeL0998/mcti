import { Suspense } from 'react';
import LoadingState from '@/components/LoadingSpinner';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MCTI Scheduling System',
  description: 'Faculty Class Scheduling Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<LoadingState />}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}