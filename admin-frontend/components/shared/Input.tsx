'use client';

import * as React from 'react';
import { Input as ShadcnInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InputProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  success?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, success, leftIcon, rightIcon, helperText, className, type, ...props }, ref) => {
    const hasError = !!error;
    const hasSuccess = !!success;

    return (
      <div className="w-full space-y-2">
        {label && (
          <label
            htmlFor={props.id}
            className="text-sm font-semibold text-foreground/80 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <ShadcnInput
            type={type}
            className={cn(
              "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              hasError && "border-destructive focus-visible:ring-destructive",
              hasSuccess && "border-emerald-500 focus-visible:ring-emerald-500",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
        {success && !error && (
          <p className="text-xs font-medium text-emerald-600">
            {success}
          </p>
        )}
        {helperText && !error && !success && (
          <p className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export default Input;
