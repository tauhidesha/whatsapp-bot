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
  { label: 'Percakapan', href: '/conversations', icon: 'inbox' },
  { label: 'Bookings', href: '/bookings', icon: 'calendar_today' },
  { label: 'CRM', href: '/crm', icon: 'groups' },
  { label: 'Follow-ups', href: '/follow-ups', icon: 'history_toggle_off' },
  { label: 'Keuangan', href: '/finance', icon: 'payments' },
  { label: 'Playground', href: '/playground', icon: 'science' },
  { label: 'Pengaturan', href: '/settings', icon: 'settings' },
];

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/' && pathname !== '/') return false;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-[85vw] max-w-sm p-6 bg-[#131313] border-r border-[#1C1B1B] flex flex-col focus:outline-none">
        <SheetHeader className="mb-10 text-left">
          <SheetTitle>
            <img 
              alt="Bosmat Studio" 
              className="w-48 h-auto" 
              src="/logo.png"
            />
          </SheetTitle>
        </SheetHeader>

        {/* Navigation Items */}
        <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-4 px-4 py-4 rounded-sm transition-all duration-200 group relative active:scale-95 font-bold",
                  active 
                    ? "bg-[#FFFF00] text-[#1D1D00]" 
                    : "text-[#CDCDCD] hover:text-[#FFFF00] hover:bg-[#1C1B1B]"
                )}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="text-xs font-headline uppercase italic tracking-widest">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto pt-8 border-t border-[#1C1B1B]">
          <div className="flex flex-col space-y-4">
            <Link 
              href="/support" 
              onClick={onClose}
              className="flex items-center text-slate-500 py-2 hover:text-[#FFFF00] text-[10px] uppercase tracking-tighter transition-colors"
            >
              <span className="material-symbols-outlined text-sm mr-3">help</span> Support Center
            </Link>
            <button 
              className="flex items-center text-slate-500 py-2 hover:text-[#FFFF00] text-[10px] uppercase tracking-tighter transition-colors w-full text-left"
              onClick={() => {/* handle logout */}}
            >
              <span className="material-symbols-outlined text-sm mr-3">logout</span> Sign Out
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
