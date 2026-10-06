
import fs from 'fs';
import path from 'path';

export class NotificationService {
    private logPath = path.join(process.cwd(), 'logs', 'notifications.log');

    constructor() {
        // Ensure logs directory exists
        const dir = path.dirname(this.logPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async sendLineMessage(message: string): Promise<boolean> {
        const timestamp = new Date().toISOString();
        const payload = `
[${timestamp}] [LINE PUSH]
------------------------------------------------
${message}
------------------------------------------------
`;
        // 1. Always Log to File
        fs.appendFileSync(this.logPath, payload);
        console.log(`[NotificationService] Logged to ${this.logPath}`);

        // 2. Try Real API Push
        const token = process.env.LINE_NOTIFY_TOKEN;
        if (token) {
            try {
                // Determine if we need to polyfill fetch (Node < 18)
                // Assuming Node 18+ environment for this project
                const response = await fetch('https://notify-api.line.me/api/notify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Bearer ${token}`
                    },
                    body: new URLSearchParams({ message: message }).toString()
                });

                if (!response.ok) {
                    const errText = await response.text();
                    console.error(`[NotificationService] LINE API Error: ${response.status} ${errText}`);
                    return false;
                }
                console.log(`[NotificationService] Sent to LINE Notify successfully.`);
                return true;
            } catch (error) {
                console.error(`[NotificationService] Network Error sending to LINE:`, error);
                return false;
            }
        } else {
            console.log(`[NotificationService] No LINE_NOTIFY_TOKEN found. Skipping real push.`);
            return true;
        }
    }
}

export const notificationService = new NotificationService();
