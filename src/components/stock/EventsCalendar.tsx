"use client";

import React from 'react';
import { Calendar, DollarSign, Users, FileText, Bell } from 'lucide-react';

const events = [
    { date: '2023-12-15', title: '法說會', type: 'meeting', desc: 'Q4 法人說明會', icon: Users, color: 'text-blue-600 bg-blue-100' },
    { date: '2023-12-20', title: '除息日', type: 'dividend', desc: '現金股利 2.5 元', icon: DollarSign, color: 'text-red-600 bg-red-100' },
    { date: '2024-01-10', title: '營收公告', type: 'report', desc: '12月營收公佈', icon: FileText, color: 'text-purple-600 bg-purple-100' },
    { date: '2024-02-15', title: '財報公佈', type: 'report', desc: '2023年全年財報', icon: FileText, color: 'text-purple-600 bg-purple-100' },
];

export function EventsCalendar() {
    return (
        <div className="bg-card rounded-lg shadow border p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    個股行事曆 (Events)
                </h3>
                <button className="p-2 hover:bg-accent rounded-full text-muted-foreground">
                    <Bell className="w-4 h-4" />
                </button>
            </div>

            <div className="relative pl-4 border-l-2 border-muted space-y-8">
                {events.map((event, index) => {
                    const Icon = event.icon;
                    return (
                        <div key={index} className="relative">
                            {/* Timeline Dot */}
                            <div className={`absolute -left-[25px] top-1 w-4 h-4 rounded-full border-2 border-background ${event.type === 'dividend' ? 'bg-red-500' : 'bg-primary'}`} />

                            <div className="flex items-start gap-4 group cursor-pointer">
                                <div className={`p-3 rounded-lg ${event.color} group-hover:scale-110 transition-transform`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-foreground">{event.title}</span>
                                        <span className="text-sm font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                            {event.date}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {event.desc}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 pt-4 border-t text-center">
                <button className="text-sm text-primary hover:underline">
                    查看完整行事曆
                </button>
            </div>
        </div>
    );
}
