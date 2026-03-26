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
  { label: 'Percakapan', href: '/conversations', icon: 'chat_bubble' },
  { label: 'Bookings', href: '/bookings', icon: 'event_available' },
  { label: 'CRM', href: '/crm', icon: 'group' },
  { label: 'Follow-ups', href: '/follow-ups', icon: 'schedule' },
  { label: 'Finance', href: '/finance', icon: 'account_balance_wallet' },
  { label: 'Playground', href: '/playground', icon: 'smart_toy' },
  { label: 'Settings', href: '/settings', icon: 'settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/' && pathname !== '/') return false;
    return pathname.startsWith(href);
  };

  return (
    // PERUBAHAN: Background disamakan sedikit tone-nya dengan area chat (bg-slate-50 atau #fbfbfb)
    <aside className="w-full md:w-64 flex-col bg-[#fbfbfb] border-r border-slate-200 hidden md:flex h-screen sticky top-0">
      <div className="p-8 pb-8">
        {/* Logo Section - Enhanced */}
        <div className="flex items-center gap-3.5 px-1">
          {/* PERUBAHAN: Ganti bg-zinc-900 jadi bg-slate-800 agar tidak terlalu pekat */}
          <div className="size-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-md shadow-slate-800/20 transform transition-transform hover:scale-105 active:scale-95 duration-200">
            {/* PERUBAHAN: Ikon diganti jadi putih biar clean */}
            <span className="material-symbols-outlined text-white text-[22px]">account_balance_wallet</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-slate-900 text-xl font-black leading-none tracking-tight">Bosmat</h2>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Admin Panel</span>
          </div>
        </div>
      </div>

      {/* Navigation Items with ScrollArea */}
      <ScrollArea className="flex-1 px-4">
        <nav className="flex flex-col gap-1.5 py-2">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  // PERUBAHAN: Kurangi padding sedikit (py-3) dan ubah rounded jadi lebih smooth (rounded-xl)
                  "flex items-center gap-4 px-5 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden",
                  active 
                    // PERUBAHAN: Ganti zinc-900 jadi slate-800
                    ? "bg-slate-800 text-white shadow-md shadow-slate-800/10" 
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
                )}
              >
                {active && (
                  // PERUBAHAN: Ganti warna indikator jadi teal-400 (warna brand aksen)
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-teal-400 rounded-r-full" />
                )}
                <span className={cn(
                  "material-symbols-outlined transition-all duration-200 text-[22px]",
                  // PERUBAHAN: Ikon aktif diberi warna teal-400 agar nyambung dengan indikator
                  active ? "text-teal-400 scale-105" : "text-slate-400 group-hover:text-slate-600"
                )}>
                  {item.icon}
                </span>
                <span className={cn(
                  "text-[13px] font-bold tracking-tight transition-colors",
                  active ? "text-white" : "text-slate-600"
                )}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Bottom Action Button */}
      <div className="p-6 mt-auto border-t border-slate-200/60 bg-[#fbfbfb]">
        {/* PERUBAHAN: Override styling button agar konsisten menggunakan warna teal-500 dan ukurannya sedikit di-tweak */}
        <Button 
          className="w-full h-12 flex items-center justify-center font-bold text-[13px] rounded-xl bg-teal-500 text-white shadow-lg shadow-teal-500/30 hover:bg-teal-600 active:scale-[0.98] transition-all border-none"
        >
          <span className="material-symbols-outlined text-[20px] mr-2">add_circle</span>
          BUAT INVOICE
        </Button>
      </div>
    </aside>
  );
}
