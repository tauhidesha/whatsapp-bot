'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showHeader?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showHeader = true,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Respond to the Escape key
  React.useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Lock scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const sizeClasses = {
    sm: 'max-w-sm w-full',
    md: 'max-w-md w-full',
    lg: 'max-w-lg w-full',
    xl: 'max-w-xl w-full',
    '2xl': 'max-w-2xl w-full',
    '4xl': 'max-w-4xl w-full',
    '6xl': 'max-w-6xl w-full',
    full: 'w-[96vw] h-[95vh]',
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-300"
      onClick={() => closeOnOverlayClick && onClose()}
    >
      {/* Modal Container */}
      <div 
        className={cn(
          "relative bg-[#0e0e0e] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/5",
          sizeClasses[size || 'md']
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {showHeader && (title || showCloseButton) && (
          <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-[#1c1b1b] shrink-0">
            {title && (
              <h3 className="text-lg font-bold font-headline uppercase tracking-tight text-white leading-none">
                {title}
              </h3>
            )}
            {showCloseButton && (
              <button 
                onClick={onClose}
                className="text-slate-500 hover:text-white transition-colors p-2"
                aria-label="Close"
              >
                <X className="size-6" />
              </button>
            )}
          </div>
        )}
        
        {/* Child Content */}
        <div className="flex-1 min-h-0 w-full flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
