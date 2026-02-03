"use client";

import * as React from "react"
import { cn } from "@/lib/utils"

const Tabs = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("w-full", className)}
        {...props}
    />
))
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
            className
        )}
        {...props}
    />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string; activeValue?: string; onValueChange?: (value: string) => void }
>(({ className, value, activeValue, onValueChange, onClick, ...props }, ref) => {
    const isActive = value === activeValue;
    return (
        <button
            ref={ref}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={(e) => {
                onValueChange?.(value);
                onClick?.(e);
            }}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive && "bg-background text-foreground shadow-sm",
                className
            )}
            {...props}
        />
    )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value: string; activeValue?: string }
>(({ className, value, activeValue, ...props }, ref) => {
    if (value !== activeValue) return null;
    return (
        <div
            ref={ref}
            role="tabpanel"
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className
            )}
            {...props}
        />
    )
})
TabsContent.displayName = "TabsContent"

// Simple wrapper to manage state if not using Radix
const TabsRoot = ({ defaultValue, children, className }: { defaultValue: string, children: React.ReactNode, className?: string }) => {
    const [activeTab, setActiveTab] = React.useState(defaultValue);

    // Clone children to pass props
    const content = React.Children.map(children, child => {
        if (React.isValidElement(child)) {
            // Check if the child is TabsList
            if (child.type === TabsList) {
                const listChild = child as React.ReactElement<React.HTMLAttributes<HTMLDivElement>>;
                return React.cloneElement(listChild, {
                    children: React.Children.map(listChild.props.children, trigger => {
                        if (React.isValidElement(trigger)) {
                            const triggerChild = trigger as React.ReactElement<{ value: string, activeValue?: string, onValueChange?: (value: string) => void }>;
                            return React.cloneElement(triggerChild, { activeValue: activeTab, onValueChange: setActiveTab });
                        }
                        return trigger;
                    })
                });
            }
            // Check if the child is TabsContent
            if (child.type === TabsContent) {
                const contentChild = child as React.ReactElement<{ value: string, activeValue?: string }>;
                return React.cloneElement(contentChild, { activeValue: activeTab });
            }
        }
        return child;
    });

    return <Tabs className={className}>{content}</Tabs>;
};

export { TabsRoot as Tabs, TabsList, TabsTrigger, TabsContent }
