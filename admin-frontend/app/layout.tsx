import type { Metadata } from 'next';
import { Inter_Tight, Lora, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";

const fontSans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Lora({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: 'Bosmat Admin - Comprehensive Admin Dashboard',
  description: 'Admin dashboard for Bosmat Repainting & Detailing Studio',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        fontSans.variable,
        fontSerif.variable,
        fontMono.variable
      )}>
        {children}
      </body>
    </html>
  );
}
