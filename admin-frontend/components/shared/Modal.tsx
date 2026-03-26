'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
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
}: ModalProps) {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn(sizeClasses[size], "p-0 overflow-hidden border-none shadow-2xl max-h-[90vh] flex flex-col")}
        onPointerDownOutside={(e) => {
          if (!closeOnOverlayClick) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!closeOnEscape) {
            e.preventDefault();
          }
        }}
      >
        {(title || showCloseButton) && (
          <DialogHeader className="p-6 pb-4 border-b bg-background shrink-0">
            {title && (
              <DialogTitle className="text-lg font-bold leading-none tracking-tight">
                {title}
              </DialogTitle>
            )}
          </DialogHeader>
        )}
        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
