"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    variant?: 'default' | 'subtle' | 'strong';
    hoverable?: boolean;
}

export function GlassCard({
    children,
    variant = 'default',
    hoverable = false,
    className,
    ...props
}: GlassCardProps) {
    return (
        <div
            className={cn(
                // Base glass styles
                variant === 'default' && 'glass-card',
                variant === 'subtle' && 'glass-subtle rounded-xl',
                variant === 'strong' && 'glass rounded-xl border-2',

                // Hover effect
                hoverable && 'hover-lift cursor-pointer',

                // Custom classes
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
