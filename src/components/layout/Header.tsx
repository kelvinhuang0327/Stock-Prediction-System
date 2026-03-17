"use client";

import Link from "next/link";
import { Search, Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 shadow-lg">
            <div className="container flex h-16 items-center px-4 md:px-6">
                <div className="mr-4 hidden md:flex">
                    <Link href="/" className="mr-6 flex items-center space-x-2">
                        <span className="hidden font-bold sm:inline-block">
                            TW Stock AI
                        </span>
                    </Link>
                    <nav className="flex items-center space-x-6 text-sm font-medium">
                        <Link
                            href="/"
                            className="transition-colors hover:text-foreground/80 text-foreground"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/watchlist"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Watchlist
                        </Link>
                        <Link
                            href="/rankings"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Rankings
                        </Link>
                        <Link
                            href="/institutional"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Institutional
                        </Link>
                        <Link
                            href="/signals"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Signals
                        </Link>
                        <Link
                            href="/backtest"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Backtest
                        </Link>
                        <Link
                            href="/screener"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Screener
                        </Link>
                        <Link
                            href="/sectors"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Sectors
                        </Link>
                        <Link
                            href="/asset-doubling"
                            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all hover:scale-105 hover:shadow-lg hover:shadow-primary/20"
                        >
                            Doubling assets
                        </Link>
                        <Link
                            href="/report/daily"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            Report
                        </Link>
                        <Link
                            href="/analysis"
                            className="transition-colors hover:text-foreground/80 text-foreground/60"
                        >
                            AI Analysis
                        </Link>
                    </nav>
                </div>
                <button
                    className="inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:text-accent-foreground h-9 py-2 mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 md:hidden"
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={isMobileMenuOpen}
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle Menu</span>
                </button>
                <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                    <div className="w-full flex-1 md:w-auto md:flex-none">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="search"
                                placeholder="Search stocks..."
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pl-8 md:w-[200px] lg:w-[300px]"
                            />
                        </div>
                    </div>
                    <nav className="flex items-center space-x-2">
                        <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9">
                            <Bell className="h-4 w-4" />
                            <span className="sr-only">Notifications</span>
                        </button>
                    </nav>
                </div>
            </div>
        </header>
    );
}
