import React from "react";
import { Header } from "@/components/layout/Header";

export function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 container mx-auto p-4">
                {children}
            </main>
        </div>
    );
}
