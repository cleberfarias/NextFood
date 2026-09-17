import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NextFood',
  description: 'SaaS para operações de alimentação'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
