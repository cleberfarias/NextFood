import type { Metadata } from 'next';
import './globals.css';
import { Fraunces, Geist } from "next/font/google";
import { cn } from "@/front/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: 'NextFood',
  description: 'SaaS para operações de alimentação'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={cn("dark font-sans", geist.variable, fraunces.variable)}>
      <body>{children}</body>
    </html>
  );
}
