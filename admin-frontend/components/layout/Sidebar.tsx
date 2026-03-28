'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Button from '@/components/shared/Button';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  label: string;
  href: string;
  icon: string;
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

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/' && pathname !== '/') return false;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 z-50 bg-[#131313] flex flex-col py-6 border-r border-[#1C1B1B] hidden md:flex">
      <div className="mb-8 px-4">
        <img 
          alt="Bosmat Studio" 
          className="w-full h-auto" 
          src="/logo.png"
        />
      </div>
      <nav className="flex-1 overflow-y-auto space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 font-bold rounded-sm mx-2 scale-95 active:scale-90 transition-all",
                active 
                  ? "bg-[#FFFF00] text-[#1D1D00]" 
                  : "text-[#CDCDCD] hover:text-[#FFFF00] hover:bg-[#1C1B1B]"
              )}
            >
              <span className="material-symbols-outlined" data-icon={item.icon}>{item.icon}</span>
              <span className="font-body tracking-tighter uppercase text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 mt-auto space-y-4">
        <div className="flex flex-col space-y-1">
          <Link 
            href="/support" 
            className="flex items-center text-slate-500 py-2 hover:text-[#FFFF00] text-[10px] uppercase tracking-tighter transition-colors"
          >
            <span className="material-symbols-outlined text-sm mr-3">help</span> Support
          </Link>
          <button 
            className="flex items-center text-slate-500 py-2 hover:text-[#FFFF00] text-[10px] uppercase tracking-tighter transition-colors w-full text-left"
            onClick={() => {/* handle logout */}}
          >
            <span className="material-symbols-outlined text-sm mr-3">logout</span> Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
