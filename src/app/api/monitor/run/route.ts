import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/NotificationService';
import { stockService } from '@/lib/stockService';

/**
 * GET /api/monitor/run
 * Triggered by cron or manual request to check alerts
 */
export async function GET() {
    try {
        // 1. Fetch active alerts
        const alerts = await prisma.priceAlert.findMany({
            where: { isActive: true },
        });

        if (alerts.length === 0) {
            return NextResponse.json({ message: 'No active alerts' });
        }

        // 2. Fetch latest prices for unique symbols
        const symbols = Array.from(new Set(alerts.map(a => a.symbol)));
        const triggeredAlerts = [];

        for (const symbol of symbols) {
            const stock = await stockService.getStock(symbol);
            if (!stock) continue;

            const relevantAlerts = alerts.filter(a => a.symbol === symbol);

            for (const alert of relevantAlerts) {
                let triggered = false;
                let message = '';

                switch (alert.type) {
                    case 'above':
                        if (stock.price >= alert.target) {
                            triggered = true;
                            message = `🚀 [警示] ${stock.name} (${stock.symbol}) 股價已突破 ${alert.target} (目前: ${stock.price})`;
                        }
                        break;
                    case 'below':
                        if (stock.price <= alert.target) {
                            triggered = true;
                            message = `📉 [警示] ${stock.name} (${stock.symbol}) 股價已跌破 ${alert.target} (目前: ${stock.price})`;
                        }
                        break;
                    case 'change_up':
                        if (stock.changePercent >= alert.target) {
                            triggered = true;
                            message = `🔥 [暴漲] ${stock.name} (${stock.symbol}) 漲幅已達 +${stock.changePercent}% (目標: +${alert.target}%)`;
                        }
                        break;
                    case 'change_down':
                        if (stock.changePercent <= -Math.abs(alert.target)) {
                            triggered = true;
                            message = `❄️ [暴跌] ${stock.name} (${stock.symbol}) 跌幅已達 ${stock.changePercent}% (目標: -${alert.target}%)`;
                        }
                        break;
                }

                if (triggered) {
                    // Send notification
                    await notificationService.sendLineMessage(message);

                    // Mark as triggered (one-time alert? or keep active? usually one-time for price targets)
                    // For now, mark TRIGGERED and DEACTIVATE
                    await prisma.priceAlert.update({
                        where: { id: alert.id },
                        data: { triggered: true, isActive: false }
                    });

                    triggeredAlerts.push({
                        symbol: alert.symbol,
                        message
                    });
                }
            }
        }

        return NextResponse.json({
            checked: alerts.length,
            triggered: triggeredAlerts.length,
            details: triggeredAlerts
        });

    } catch (error) {
        console.error('Monitor Error:', error);
        return NextResponse.json({ error: 'Monitor Failed' }, { status: 500 });
    }
}
