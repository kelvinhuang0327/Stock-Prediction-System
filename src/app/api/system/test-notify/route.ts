
import { NextResponse } from 'next/server';
import { notificationService } from '@/lib/services/NotificationService';

export async function POST() {
    try {
        const success = await notificationService.send(
            '🔔 System Test: Notification System is Online!\n' +
            'If you see this, your LINE Notify integration is working perfectly.'
        );

        if (success) {
            return NextResponse.json({ success: true, message: 'Notification sent' });
        } else {
            return NextResponse.json({ success: false, message: 'Notification failed (Check logs/token)' }, { status: 500 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
