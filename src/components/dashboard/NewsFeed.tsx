import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, ExternalLink } from 'lucide-react';

export function NewsFeed() {
    const news = [
        { id: 1, title: '台積電法說會重點整理：Q4 營收優於預期', source: 'MoneyDJ', time: '10:30', category: '頭條' },
        { id: 2, title: '美股收盤：那指創新高，AI 概念股續強', source: 'Anue', time: '09:15', category: '國際' },
        { id: 3, title: 'AI 伺服器需求強勁，供應鏈出貨看增', source: '工商時報', time: '08:45', category: '產業' },
        { id: 4, title: '央行維持利率不變，暗示明年可能降息', source: '經濟日報', time: '08:30', category: '總經' },
        { id: 5, title: '外資買超百億，鎖定半導體與金融股', source: 'CMoney', time: '08:15', category: '籌碼' },
    ];

    return (
        <div className="bg-card rounded-xl shadow-sm border h-full">
            <div className="p-4 border-b">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    即時新聞
                    <Badge variant="secondary" className="text-xs font-normal">Live</Badge>
                </h3>
            </div>
            <div className="divide-y">
                {news.map((item) => (
                    <div key={item.id} className="p-4 hover:bg-muted/50 transition-colors group cursor-pointer">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                        {item.category}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {item.time}
                                    </span>
                                    <span className="text-xs text-primary font-medium">{item.source}</span>
                                </div>
                                <h4 className="font-medium leading-snug group-hover:text-primary transition-colors">
                                    {item.title}
                                </h4>
                            </div>
                            <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-3 text-center border-t bg-muted/10">
                <button className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
                    查看更多新聞
                </button>
            </div>
        </div>
    );
}
