"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'default' | 'primary' | 'success' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
}

export function GlassButton({
    children,
    variant = 'default',
    size = 'md',
    loading = false,
    icon,
    className,
    disabled,
    ...props
}: GlassButtonProps) {
    return (
        <button
            className={cn(
                // Base glass button styles
                'glass-subtle relative overflow-hidden',
                'font-medium transition-all duration-200',
                'active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',

                // Size variants
                size === 'sm' && 'px-3 py-1.5 text-sm rounded-lg',
                size === 'md' && 'px-4 py-2 text-sm rounded-xl',
                size === 'lg' && 'px-6 py-3 text-base rounded-xl',

                // Color variants
                variant === 'default' && 'hover:bg-white/5',
                variant === 'primary' && 'bg-primary/20 hover:bg-primary/30 text-primary-foreground border-primary/30',
                variant === 'success' && 'bg-success/20 hover:bg-success/30 text-success-foreground border-success/30',
                variant === 'danger' && 'bg-destructive/20 hover:bg-destructive/30 text-destructive-foreground border-destructive/30',

                // Hover effects
                'hover:shadow-lg hover:-translate-y-0.5',

                className
            )}
            disabled={disabled || loading}
            {...props}
        >
            {/* Shimmer effect on hover */}
            <span className="absolute inset-0 shimmer opacity-0 hover:opacity-100" />

            {/* Button content */}
            <span className="relative flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {!loading && icon && icon}
                {children}
            </span>
        </button>
    );
}
