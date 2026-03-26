'use client';

import { Button as ShadcnButton } from '@/components/ui/button';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends Omit<React.ComponentProps<typeof ShadcnButton>, 'variant' | 'size'> {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'icon' | 'outline' | 'ghost' | 'destructive' | 'default';
  size?: 'sm' | 'md' | 'lg' | 'default' | 'icon';
  isLoading?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  ...props
}: ButtonProps) {
  
  const getShadcnProps = () => {
    switch (variant) {
      case 'primary':
        return { 
          variant: 'default' as const,
          className: cn('font-bold text-zinc-950 shadow-md transition-all active:scale-95', className)
        };
      case 'secondary':
        return { 
          variant: 'ghost' as const,
          className: cn('text-slate-600 font-semibold hover:text-slate-900 hover:bg-slate-100', className)
        };
      case 'danger':
        return { 
          variant: 'destructive' as const,
          className: cn('shadow-md', className)
        };
      case 'success':
        return { 
          variant: 'default' as const,
          className: cn('bg-emerald-500 text-white hover:bg-emerald-600 shadow-md', className)
        };
      case 'icon':
        return { 
          variant: 'ghost' as const,
          size: 'icon' as const,
          className: cn('bg-slate-100 text-slate-600 hover:bg-slate-200', className)
        };
      default:
        return { variant: (variant as any) || 'default', className };
    }
  };

  const shadcnProps = getShadcnProps();
  const shadcnSize = size === 'md' ? 'default' : size;

  return (
    <ShadcnButton
      {...(shadcnProps as any)}
      size={(shadcnProps.size as any) || (shadcnSize as any)}
      disabled={isLoading || props.disabled}
      className={shadcnProps.className}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center gap-2">
          <div className="size-4 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
          {children}
        </div>
      ) : (
        children
      )}
    </ShadcnButton>
  );
}
