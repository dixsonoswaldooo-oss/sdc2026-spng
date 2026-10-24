import type { Metadata } from 'next';
import { LangProvider } from '@/components/LangProvider';
import { StoreProvider } from '@/lib/store';
import './globals.css';

export const metadata: Metadata = {
  title: 'e-Salary Guard · Orbyte',
  description: 'Take-home pay calculated from attendance, with early WhatsApp alerts for every deduction.',
  icons: { icon: '/assets/favicon-32.png', apple: '/assets/favicon-180.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Same font and loading as orbyte.my */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300..800;1,300..700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <StoreProvider><LangProvider>{children}</LangProvider></StoreProvider>
      </body>
    </html>
  );
}
