"use client";

import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import { stockService } from '@/lib/stockService';
import { EconomicEvent } from '@/lib/mockData';

export default function CalendarPage() {
    const [events, setEvents] = useState<EconomicEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'earnings' | 'dividend' | 'economic' | 'meeting'>('all');

    useEffect(() => {
        let active = true;
        (async () => {
            const data = await stockService.getEconomicEvents();
            if (!active) return;
            setEvents(data);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, []);

    const filteredEvents = filter === 'all'
        ? events
        : events.filter(e => e.type === filter);

    const groupedByDate = filteredEvents.reduce((acc, event) => {
        const date = event.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
    }, {} as Record<string, EconomicEvent[]>);

    const getEventIcon = (type: EconomicEvent['type']) => {
        switch (type) {
            case 'earnings': return TrendingUp;
            case 'dividend': return DollarSign;
            case 'economic': return AlertCircle;
            case 'meeting': return CalendarIcon;
        }
    };

    const getEventColor = (importance: EconomicEvent['importance']) => {
        switch (importance) {
            case 'high': return 'border-red-500 bg-red-50 dark:bg-red-950/20';
            case 'medium': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
            case 'low': return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
        }
    };

    const getTypeLabel = (type: EconomicEvent['type']) => {
        switch (type) {
            case 'earnings': return '法說會';
            case 'dividend': return '除權息';
            case 'economic': return '經濟指標';
            case 'meeting': return '會議';
        }
    };

    const filterTabs: ReadonlyArray<{ value: typeof filter; label: string }> = [
        { value: 'all', label: '全部事件' },
        { value: 'earnings', label: '法說會' },
        { value: 'dividend', label: '除權息' },
        { value: 'economic', label: '經濟指標' },
    ];

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold">Economic Calendar</h1>
                <p className="text-muted-foreground">重要財經事件與公司行事曆</p>
            </div>

            {/* Filter Tabs */}
            <div className="bg-card rounded-xl shadow-sm border p-4">
                <div className="flex gap-2 flex-wrap">
                    {filterTabs.map(tab => (
                        <button
                            key={tab.value}
                            onClick={() => setFilter(tab.value)}
                            className={`px-4 py-2 rounded-md transition-colors ${filter === tab.value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted hover:bg-muted/80'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Events List */}
            {loading ? (
                <div className="bg-card rounded-xl shadow-sm border p-8 text-center text-muted-foreground">
                    載入中...
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(groupedByDate).map(([date, dayEvents]) => {
                        const dateObj = new Date(date);
                        const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()];

                        return (
                            <div key={date} className="bg-card rounded-xl shadow-sm border overflow-hidden">
                                <div className="p-4 border-b bg-muted/30 flex items-center gap-3">
                                    <CalendarIcon className="w-5 h-5 text-primary" />
                                    <div>
                                        <div className="font-bold text-lg">
                                            {dateObj.getMonth() + 1}/{dateObj.getDate()} (週{dayOfWeek})
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {dayEvents.length} 個事件
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 space-y-3">
                                    {dayEvents.map((event) => {
                                        const Icon = getEventIcon(event.type);

                                        return (
                                            <div
                                                key={event.id}
                                                className={`border-l-4 rounded-lg p-4 ${getEventColor(event.importance)}`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-3 flex-1">
                                                        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold">{event.title}</span>
                                                                {event.symbol && (
                                                                    <span className="text-xs bg-background px-2 py-0.5 rounded font-mono">
                                                                        {event.symbol}
                                                                    </span>
                                                                )}
                                                                <span className="text-xs bg-background px-2 py-0.5 rounded">
                                                                    {getTypeLabel(event.type)}
                                                                </span>
                                                            </div>
                                                            {event.description && (
                                                                <div className="text-sm text-muted-foreground">
                                                                    {event.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {event.time && (
                                                        <div className="text-sm font-medium ml-4">
                                                            {event.time}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
