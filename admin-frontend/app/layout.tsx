import type { Metadata } from 'next';
import { Inter, League_Spartan, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const fontHeadline = League_Spartan({
  subsets: ["latin"],
  variable: "--font-headline",
  weight: ["700", "800", "900"],
});

const fontTechnical = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-technical",
  weight: ["300", "400", "500", "600", "700"],
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
    <html lang="id" className="dark">
      <body className={cn(
        "min-h-screen bg-background font-body antialiased",
        fontSans.variable,
        fontHeadline.variable,
        fontTechnical.variable
      )}>
        {children}
      </body>
    </html>
  );
}
