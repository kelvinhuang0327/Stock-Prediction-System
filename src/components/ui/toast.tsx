"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
        const id = Math.random().toString(36).substr(2, 9);
        const toast: Toast = { id, type, message, duration };

        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast, index) => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onRemove={removeToast}
                        index={index}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({
    toast,
    onRemove,
    index
}: {
    toast: Toast;
    onRemove: (id: string) => void;
    index: number;
}) {
    const icons = {
        success: <CheckCircle className="w-5 h-5" />,
        error: <AlertCircle className="w-5 h-5" />,
        info: <Info className="w-5 h-5" />,
        warning: <AlertTriangle className="w-5 h-5" />
    };

    const styles = {
        success: 'text-success border-success/30 bg-success/10',
        error: 'text-destructive border-destructive/30 bg-destructive/10',
        info: 'text-primary border-primary/30 bg-primary/10',
        warning: 'text-warning border-warning/30 bg-warning/10'
    };

    return (
        <div
            className={cn(
                "glass-card p-4 min-w-[300px] max-w-md pointer-events-auto",
                "border-l-4 shadow-xl",
                "animate-[slideInFromRight_0.3s_ease-out]",
                styles[toast.type]
            )}
            style={{
                animationDelay: `${index * 100}ms`,
                animationFillMode: 'backwards'
            }}
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                    {icons[toast.type]}
                </div>
                <div className="flex-1 text-sm font-medium">
                    {toast.message}
                </div>
                <button
                    onClick={() => onRemove(toast.id)}
                    className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Progress bar */}
            {toast.duration && toast.duration > 0 && (
                <div className="mt-2 h-1 bg-border/30 rounded-full overflow-hidden">
                    <div
                        className={cn("h-full", styles[toast.type])}
                        style={{
                            animation: `shrink ${toast.duration}ms linear forwards`
                        }}
                    />
                </div>
            )}
        </div>
    );
}

// Add keyframe for progress bar in globals.css
// @keyframes shrink {
//   from { width: 100%; }
//   to { width: 0%; }
// }
