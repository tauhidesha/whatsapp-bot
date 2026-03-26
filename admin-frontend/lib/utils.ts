import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(timeMs: number): string {
  const diff = Date.now() - timeMs;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit`;
  if (hours < 24) return `${hours} jam`;
  if (days < 7) return `${days} hari`;
  
  return new Date(timeMs).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
}
