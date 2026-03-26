'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { LayoutProvider, useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <LayoutProvider>
      <DashboardLayoutContent mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen}>
        {children}
      </DashboardLayoutContent>
    </LayoutProvider>
  );
}

function DashboardLayoutContent({
  children,
  mobileMenuOpen,
  setMobileMenuOpen
}: {
  children: React.ReactNode,
  mobileMenuOpen: boolean,
  setMobileMenuOpen: (open: boolean) => void
}) {
  const { isHeaderVisible } = useLayout();

  return (
    <div className="flex h-screen w-full flex-col md:flex-row bg-slate-50 overflow-hidden relative">
      {/* Sidebar */}
      <Sidebar />

      {/* Mobile Navigation */}
      <MobileNav isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header - Fixed on mobile with auto-hide, static on desktop */}
        <div className={cn(
          "fixed top-0 left-0 right-0 z-30 transition-transform duration-300 ease-in-out",
          "md:static md:translate-y-0 md:z-auto",
          isHeaderVisible ? "translate-y-0" : "-translate-y-full"
        )}>
          <Header onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
        </div>

        {/* Spacer untuk fixed header di mobile - animate bersama header */}
        <div className={cn(
          "shrink-0 md:hidden transition-all duration-300 ease-in-out",
          isHeaderVisible ? "h-16" : "h-0"
        )} />

        {/* Page Content */}
        <section className="flex-1 overflow-y-auto relative">
          {children}
        </section>
      </main>
    </div>
  );
}