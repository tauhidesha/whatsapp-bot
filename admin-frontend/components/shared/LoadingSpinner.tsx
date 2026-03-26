/**
 * Loading Spinner Component
 * Matches the design system with primary color
 */

'use client';

export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`${sizeClasses[size]} border-slate-200 dark:border-slate-700 border-t-primary rounded-full animate-spin`}
        role="status"
        aria-label="Memuat..."
      />
    </div>
  );
}
