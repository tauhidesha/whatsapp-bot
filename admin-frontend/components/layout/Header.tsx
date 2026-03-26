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
  const { isHeaderVisible } = useLayout();

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
      "h-16 border-b bg-white flex items-center justify-between px-6 shrink-0 transition-transform duration-300 ease-in-out",
      "md:translate-y-0",
      !isHeaderVisible && "-translate-y-full"
    )}>
      {/* Left side - Mobile menu toggle */}
      <div className="flex items-center gap-4 md:hidden">
        <button
          onClick={onMobileMenuToggle}
          className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>

      {/* Right side - User menu with Dropdown */}
      <div className="flex items-center gap-4 ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-xl transition-colors outline-none">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 leading-none mb-1">
                  {user?.email?.split('@')[0] || 'Admin'}
                </p>
                <p className="text-[10px] text-slate-500">{user?.email}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                <span className="material-symbols-outlined text-primary text-[22px]">account_circle</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1 p-1.5 rounded-xl shadow-xl">
            <DropdownMenuLabel className="font-normal px-2 py-1.5">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none">Akun Saya</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem className="p-2 rounded-lg cursor-pointer focus:bg-slate-50" onClick={() => router.push('/settings')}>
              <span className="material-symbols-outlined text-[18px] mr-2">settings</span>
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              className="p-2 rounded-lg cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={handleLogout}
            >
              <span className="material-symbols-outlined text-[18px] mr-2">logout</span>
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}