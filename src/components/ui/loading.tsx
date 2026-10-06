"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-8 h-8 border-3',
        lg: 'w-12 h-12 border-4'
    };

    return (
        <div
            className={cn(
                'rounded-full border-primary border-t-transparent animate-spin',
                sizeClasses[size],
                className
            )}
        />
    );
}

interface LoadingDotsProps {
    className?: string;
}

export function LoadingDots({ className }: LoadingDotsProps) {
    return (
        <div className={cn('flex items-center gap-1', className)}>
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="w-2 h-2 bg-primary rounded-full animate-pulse"
                    style={{
                        animationDelay: `${i * 200}ms`,
                        animationDuration: '1s'
                    }}
                />
            ))}
        </div>
    );
}

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
    return (
        <div
            className={cn(
                'bg-muted/20 shimmer',
                variant === 'text' && 'h-4 rounded',
                variant === 'circular' && 'rounded-full',
                variant === 'rectangular' && 'rounded-lg',
                className
            )}
        />
    );
}
