/**
 * EmailProvider.ts
 *
 * Nodemailer-based SMTP email provider for NotificationDeliveryEngine.
 *
 * Configuration (environment variables):
 *   NOTIFY_EMAIL_TO       — recipient address (required)
 *   NOTIFY_EMAIL_FROM     — sender address (default: NOTIFY_SMTP_USER or "noreply@stock-insight")
 *   NOTIFY_SMTP_HOST      — SMTP hostname (e.g. smtp.gmail.com)
 *   NOTIFY_SMTP_PORT      — SMTP port (default: 587)
 *   NOTIFY_SMTP_SECURE    — "true" for port 465 SSL, otherwise STARTTLS (default: false)
 *   NOTIFY_SMTP_USER      — SMTP auth username
 *   NOTIFY_SMTP_PASS      — SMTP auth password / app password
 *
 * Security:
 *   - Credentials are read from env only; never logged or exposed
 *   - Email target is masked in /api/notify/status
 *   - Email content is research-oriented with disclaimer; never claims guarantees
 *
 * Degraded behaviour:
 *   - NOTIFY_EMAIL_TO missing    → status "skipped"
 *   - SMTP not configured        → status "skipped" (not "failed" — not attempted)
 *   - SMTP connection error      → status "failed" with errorMessage
 *   - SMTP auth error            → status "failed" with errorMessage
 */

import type { DeliveryProvider, DeliveryResult } from './NotificationDeliveryEngine';

// ─── Markdown → HTML converter (minimal, no external dep) ─────────

/**
 * Converts the markdown payload from NotificationPayloadAdapter into
 * a simple HTML email body. Handles headings, bold, italic, hr, lists,
 * and blockquotes. Wrapped in a clean email-safe HTML template.
 */
function markdownToHtml(markdown: string, subject: string): string {
  // Escape HTML special chars first (except in our own tags)
  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const lines = markdown.split('\n');
  const htmlLines: string[] = [];
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine;

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push('<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">');
      continue;
    }

    // Headings
    const h1 = line.match(/^# (.+)/);
    if (h1) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<h1 style="color:#1e293b;font-size:20px;font-weight:700;margin:0 0 8px">${escapeHtml(h1[1])}</h1>`);
      continue;
    }
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<h2 style="color:#334155;font-size:16px;font-weight:600;margin:16px 0 6px;padding-left:8px;border-left:3px solid #6366f1">${escapeHtml(h2[1])}</h2>`);
      continue;
    }
    const h3 = line.match(/^### (.+)/);
    if (h3) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<h3 style="color:#475569;font-size:14px;font-weight:600;margin:12px 0 4px">${escapeHtml(h3[1])}</h3>`);
      continue;
    }

    // Blockquote
    const bq = line.match(/^> (.+)/);
    if (bq) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      htmlLines.push(`<blockquote style="border-left:3px solid #94a3b8;margin:8px 0;padding:6px 12px;color:#64748b;font-style:italic">${renderInline(bq[1])}</blockquote>`);
      continue;
    }

    // List item
    if (/^- /.test(line)) {
      if (!inList) { htmlLines.push('<ul style="margin:6px 0;padding-left:20px">'); inList = true; }
      htmlLines.push(`<li style="color:#475569;margin:2px 0">${renderInline(line.slice(2))}</li>`);
      continue;
    }

    // End list on blank/non-list line
    if (inList) { htmlLines.push('</ul>'); inList = false; }

    // Empty line
    if (!line.trim()) {
      htmlLines.push('<br>');
      continue;
    }

    // Regular paragraph
    htmlLines.push(`<p style="margin:4px 0;color:#334155">${renderInline(line)}</p>`);
  }

  if (inList) htmlLines.push('</ul>');

  const body = htmlLines.join('\n');

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:20px 24px">
      <div style="color:#f1f5f9;font-size:12px;font-weight:500;letter-spacing:0.05em;margin-bottom:4px">STOCK 洞察平台</div>
      <div style="color:#e2e8f0;font-size:10px">研究參考用途 · 非投資建議</div>
    </div>
    <!-- Content -->
    <div style="padding:24px">
      ${body}
    </div>
    <!-- Footer -->
    <div style="background:#f1f5f9;padding:12px 24px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0">
      此為 Stock 洞察平台自動生成的研究提醒，僅供研究參考，不構成投資建議。
      市場有風險，投資前請審慎評估。
    </div>
  </div>
</body>
</html>`;
}

/** Handles inline markdown: **bold**, _italic_, backtick code */
function renderInline(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em style="color:#64748b">$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:12px">$1</code>');
}

// ─── Nodemailer Transport Factory ────────────────────────────────

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function readSmtpConfig(): SmtpConfig | null {
  const host = process.env.NOTIFY_SMTP_HOST;
  const user = process.env.NOTIFY_SMTP_USER;
  const pass = process.env.NOTIFY_SMTP_PASS;

  // All three are required for a usable SMTP config
  if (!host || !user || !pass) return null;

  const port = parseInt(process.env.NOTIFY_SMTP_PORT ?? '587', 10);
  const secure = process.env.NOTIFY_SMTP_SECURE === 'true' || port === 465;
  const from = process.env.NOTIFY_EMAIL_FROM ?? user;

  return { host, port, secure, user, pass, from };
}

// ─── EmailDeliveryProvider ────────────────────────────────────────

export class NodemailerEmailProvider implements DeliveryProvider {
  readonly channel = 'email';
  readonly payloadType = 'markdown' as const;
  readonly target: string | null;

  private smtpConfig: SmtpConfig | null;
  private timeoutMs: number;

  constructor(options?: { to?: string; timeoutMs?: number }) {
    this.target = options?.to ?? process.env.NOTIFY_EMAIL_TO ?? null;
    this.smtpConfig = readSmtpConfig();
    this.timeoutMs = options?.timeoutMs ?? 15_000;
  }

  /** True if both recipient AND SMTP are configured */
  get isFullyConfigured(): boolean {
    return !!this.target && !!this.smtpConfig;
  }

  async send(payload: string): Promise<DeliveryResult> {
    if (!this.target) {
      return { success: false, error: 'NOTIFY_EMAIL_TO not configured' };
    }
    if (!this.smtpConfig) {
      return {
        success: false,
        error: 'SMTP not configured. Set NOTIFY_SMTP_HOST, NOTIFY_SMTP_USER, NOTIFY_SMTP_PASS.',
      };
    }

    // Parse subject from payload (first line that starts with "# " contains the title)
    const subjectMatch = payload.match(/^# (.+)$/m);
    const subject = subjectMatch ? subjectMatch[1] : 'Stock洞察平台｜每日研究提醒';

    // Convert markdown to HTML
    const html = markdownToHtml(payload, subject);
    // Plain text fallback: strip markdown markers
    const text = payload
      .replace(/^#{1,3} /gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/^> /gm, '')
      .replace(/^- /gm, '• ');

    try {
      // Dynamic import — nodemailer is a server-side only module
      const nodemailer = await import('nodemailer');

      const transport = nodemailer.default.createTransport({
        host: this.smtpConfig.host,
        port: this.smtpConfig.port,
        secure: this.smtpConfig.secure,
        auth: {
          user: this.smtpConfig.user,
          pass: this.smtpConfig.pass,
        },
        connectionTimeout: this.timeoutMs,
        greetingTimeout: this.timeoutMs,
        socketTimeout: this.timeoutMs,
      });

      const info = await transport.sendMail({
        from: `Stock洞察平台 <${this.smtpConfig.from}>`,
        to: this.target,
        subject,
        text,
        html,
      });

      // Nodemailer returns messageId on success
      return {
        success: true,
        statusCode: 250,
        responseBody: info.messageId ?? 'sent',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Strip any credential references from error messages before logging
      const safeMessage = message
        .replace(/auth[^)]*\)/gi, 'auth(...)')
        .replace(/password[^,)>]*/gi, 'password=***');
      return { success: false, error: safeMessage };
    }
  }
}

// ─── SMTP config status (for /api/notify/status) ─────────────────

export interface SmtpConfigStatus {
  smtpConfigured: boolean;
  smtpHost: string | null;   // hostname only, no credentials
  smtpPort: number | null;
  smtpSecure: boolean | null;
}

export function getSmtpConfigStatus(): SmtpConfigStatus {
  const cfg = readSmtpConfig();
  return {
    smtpConfigured: cfg !== null,
    smtpHost: cfg?.host ?? null,
    smtpPort: cfg?.port ?? null,
    smtpSecure: cfg?.secure ?? null,
  };
}
