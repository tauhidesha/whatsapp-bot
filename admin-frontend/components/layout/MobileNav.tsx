'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard' },
  { label: 'Percakapan', href: '/conversations', icon: 'chat_bubble' },
  { label: 'Bookings', href: '/bookings', icon: 'event_available' },
  { label: 'CRM', href: '/crm', icon: 'group' },
  { label: 'Follow-ups', href: '/follow-ups', icon: 'schedule' },
  { label: 'Finance', href: '/finance', icon: 'account_balance_wallet' },
  { label: 'Playground', href: '/playground', icon: 'smart_toy' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/' && pathname !== '/') return false;
    return pathname.startsWith(href);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* PERUBAHAN: Background disamakan sedikit tone-nya dengan area chat (bg-[#fbfbfb]) */}
      <SheetContent side="left" className="w-64 p-6 bg-[#fbfbfb] border-r border-slate-200 flex flex-col focus:outline-none">
        <SheetHeader className="mb-8 mt-4">
          <SheetTitle className="text-left">
            <div className="flex items-center gap-3.5">
              {/* PERUBAHAN: Ganti bg-zinc-950 jadi bg-slate-800 agar tidak terlalu pekat */}
              <div className="size-9 bg-slate-800 rounded-xl flex items-center justify-center shadow-md shadow-slate-800/20">
                <span className="material-symbols-outlined text-white text-[18px]">account_balance_wallet</span>
              </div>
              <div className="flex flex-col">
                <h2 className="text-slate-900 text-lg font-black leading-none tracking-tight">Bosmat</h2>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Admin Panel</span>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Navigation Items */}
        <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                  active 
                    // PERUBAHAN: Ganti zinc-900 jadi slate-800
                    ? "bg-slate-800 text-white shadow-md shadow-slate-800/10" 
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
                )}
              >
                {active && (
                  // PERUBAHAN: Ganti warna indikator jadi teal-400
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-400 rounded-r-full" />
                )}
                <span
                  className={cn(
                    "material-symbols-outlined transition-colors text-[22px]",
                    // PERUBAHAN: Ikon aktif diberi warna teal-400
                    active ? 'text-teal-400' : 'text-slate-400 group-hover:text-slate-600'
                  )}
                >
                  {item.icon}
                </span>
                <span className={cn(
                  "text-[13px] font-bold tracking-tight transition-colors",
                  active ? "text-white" : "text-slate-600"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto pt-6 border-t border-slate-200/60">
          {/* PERUBAHAN: Override styling button agar konsisten menggunakan warna teal-500 */}
          <button className="flex w-full items-center justify-center gap-2 rounded-xl h-11 px-4 bg-teal-500 text-white text-[13px] font-bold tracking-tight hover:bg-teal-600 active:scale-[0.98] transition-all shadow-lg shadow-teal-500/30">
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>BUAT INVOICE</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
