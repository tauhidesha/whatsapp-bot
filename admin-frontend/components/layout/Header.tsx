'use client';

import * as React from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLayout } from '@/context/LayoutContext';

interface HeaderProps {
  onMobileMenuToggle?: () => void;
}

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { isHeaderVisible, headerTitle, headerExtra } = useLayout();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className={cn(
      "fixed top-0 right-0 left-0 md:left-64 z-40 bg-[#131313] md:bg-[#131313]/60 md:backdrop-blur-xl border-b border-[#1C1B1B] h-16 flex justify-between items-center transition-all duration-300 ease-in-out px-6",
      "translate-y-0",
      !isHeaderVisible && "-translate-y-full"
    )}>
      
      {/* =========================================
          MOBILE VIEW HEADER (Khusus Layar HP)
          ========================================= */}
      <div className="flex w-full justify-between items-center md:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={onMobileMenuToggle} 
            className="text-[#FFFF00] outline-none active:scale-95 transition-transform flex items-center justify-center"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="text-2xl font-headline font-black tracking-tighter lowercase text-white mt-1">bosmat studio</h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-[#FFFF00] outline-none active:scale-95 transition-transform flex items-center justify-center">
            <span className="material-symbols-outlined">settings_input_component</span>
          </button>
        </div>
      </div>

      {/* =========================================
          DESKTOP VIEW HEADER (Khusus Layar Besar)
          ========================================= */}
      {/* Left side - Title and Subtitle */}
      <div className="hidden md:flex flex-col justify-center shrink-0">
        <h1 className={cn(
          "text-xl font-headline font-black tracking-widest leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] uppercase",
          headerTitle === 'INBOX CONTROL' ? "text-[#FFFF00]" : "text-white"
        )}>
          {headerTitle}
        </h1>
        <p className="text-[9px] text-slate-500 font-label tracking-wide uppercase mt-1">
          {headerTitle === 'INBOX CONTROL' 
            ? 'Monitoring pesan masuk dan kontrol AI assistant Zoya.' 
            : 'Ringkasan aktivitas bengkel dan performa AI Zoya hari ini.'}
        </p>
      </div>

      {/* Middle - Extra content (e.g. Search Bar) */}
      <div className="hidden md:flex flex-1 justify-center max-w-xl px-12">
        {headerExtra}
      </div>

      {/* Right side - Actions and Profile */}
      <div className="hidden md:flex items-center space-x-6">
        <div className="flex items-center space-x-4">
          <button className="text-[#CDCDCD] hover:text-[#FFFF00] transition-colors active:scale-95">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="text-[#CDCDCD] hover:text-[#FFFF00] transition-colors active:scale-95" onClick={() => router.push('/settings')}>
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>

        <div className="flex items-center space-x-3 border-l border-[#1C1B1B] pl-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 outline-none group text-right">
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-wider">
                    {user?.displayName || user?.email?.split('@')[0] || 'Tauhidesha'}
                  </p>
                  <p className="text-[9px] text-[#FFFF00] uppercase font-black tracking-widest">Administrator</p>
                </div>
                <div className="w-10 h-10 rounded-sm border border-white/10 overflow-hidden group-hover:border-[#FFFF00] transition-all bg-[#1C1B1B] flex items-center justify-center shrink-0">
                  {user?.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt="Google Profile" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-all duration-300"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-slate-500">account_circle</span>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-2 glass-panel border-[#1C1B1B] text-[#e5e2e1]">
              <DropdownMenuLabel className="font-normal px-2 py-1.5">
                <div className="flex flex-col space-y-1">
                  <p className="font-headline text-sm font-bold uppercase tracking-wider">Profile</p>
                  <p className="text-[10px] text-slate-500">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#1C1B1B]" />
              <DropdownMenuItem className="p-2 rounded-sm cursor-pointer hover:bg-[#1C1B1B] hover:text-[#FFFF00]" onClick={() => router.push('/settings')}>
                <span className="material-symbols-outlined text-sm mr-3">settings</span>
                <span className="text-[10px] uppercase font-bold tracking-widest">Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#1C1B1B]" />
              <DropdownMenuItem
                className="p-2 rounded-sm cursor-pointer text-red-400 hover:bg-red-900/20 group"
                onClick={handleLogout}
              >
                <span className="material-symbols-outlined text-sm mr-3">logout</span>
                <span className="text-[10px] uppercase font-bold tracking-widest">Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}