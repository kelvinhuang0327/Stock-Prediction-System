jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: jest.fn() },
}));

import nodemailer from 'nodemailer';
import { NodemailerEmailProvider } from '../EmailProvider';

const createTransport = nodemailer.createTransport as unknown as jest.Mock;
const configKeys = [
  'NOTIFY_EMAIL_TO',
  'NOTIFY_EMAIL_FROM',
  'NOTIFY_SMTP_HOST',
  'NOTIFY_SMTP_PORT',
  'NOTIFY_SMTP_SECURE',
  'NOTIFY_SMTP_USER',
  'NOTIFY_SMTP_PASS',
];

describe('NodemailerEmailProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of configKeys) delete process.env[key];
  });

  it('reports missing recipient and SMTP configuration without importing the transport', async () => {
    const missingRecipient = new NodemailerEmailProvider();
    expect(missingRecipient.target).toBeNull();
    expect(missingRecipient.isFullyConfigured).toBe(false);
    await expect(missingRecipient.send('# Test')).resolves.toEqual({ success: false, error: 'NOTIFY_EMAIL_TO not configured' });

    const missingSmtp = new NodemailerEmailProvider({ to: 'user@example.com' });
    await expect(missingSmtp.send('# Test')).resolves.toMatchObject({ success: false, error: expect.stringContaining('SMTP not configured') });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('renders markdown safely and sends email over implicit SSL on port 465', async () => {
    process.env.NOTIFY_SMTP_HOST = 'smtp.example.com';
    process.env.NOTIFY_SMTP_USER = 'mailer@example.com';
    process.env.NOTIFY_SMTP_PASS = 'secret';
    process.env.NOTIFY_SMTP_PORT = '465';
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'message-123' });
    createTransport.mockReturnValue({ sendMail });
    const provider = new NodemailerEmailProvider({ to: 'reader@example.com', timeoutMs: 2000 });
    const payload = [
      '# <Daily & report>',
      '## Summary',
      '### Details',
      '> Quote **bold**',
      '- Item _italic_ with `code`',
      '- Second item',
      '---',
      'A paragraph with <tag> & "quotes".',
      '',
      'After blank line.',
    ].join('\n');

    await expect(provider.send(payload)).resolves.toEqual({ success: true, statusCode: 250, responseBody: 'message-123' });
    expect(provider.isFullyConfigured).toBe(true);
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'mailer@example.com', pass: 'secret' },
      connectionTimeout: 2000,
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'reader@example.com',
      subject: '<Daily & report>',
      text: expect.stringContaining('• Item italic with `code`'),
      html: expect.stringContaining('&lt;Daily &amp; report&gt;'),
    }));
    const sentHtml = (sendMail.mock.calls[0]![0] as { html: string }).html;
    expect(sentHtml).toContain('<h2');
    expect(sentHtml).toContain('<h3');
    expect(sentHtml).toContain('<blockquote');
    expect(sentHtml).toContain('<strong>bold</strong>');
    expect(sentHtml).toContain('<em');
    expect(sentHtml).toContain('<code');
    expect(sentHtml).toContain('<hr');
    expect(sentHtml).toContain('&lt;tag&gt; &amp; &quot;quotes&quot;');
    expect(sentHtml).toContain('<br>');
  });

  it('uses fallback subject and sender overrides and defaults an absent message id', async () => {
    process.env.NOTIFY_SMTP_HOST = 'smtp.example.com';
    process.env.NOTIFY_SMTP_USER = 'mailer@example.com';
    process.env.NOTIFY_SMTP_PASS = 'secret';
    process.env.NOTIFY_SMTP_PORT = '2525';
    process.env.NOTIFY_SMTP_SECURE = 'true';
    process.env.NOTIFY_EMAIL_FROM = 'research@example.com';
    const sendMail = jest.fn().mockResolvedValue({});
    createTransport.mockReturnValue({ sendMail });

    await expect(new NodemailerEmailProvider({ to: 'reader@example.com' }).send('Plain text')).resolves.toEqual({
      success: true,
      statusCode: 250,
      responseBody: 'sent',
    });
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 2525, secure: true }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Stock洞察平台 <research@example.com>',
      subject: 'Stock洞察平台｜每日研究提醒',
      text: 'Plain text',
    }));
  });

  it('masks credential references in Error and non-Error transport failures', async () => {
    process.env.NOTIFY_SMTP_HOST = 'smtp.example.com';
    process.env.NOTIFY_SMTP_USER = 'mailer@example.com';
    process.env.NOTIFY_SMTP_PASS = 'secret';
    const sendMail = jest.fn().mockRejectedValueOnce(new Error('auth(secret) password=hunter2, denied'));
    createTransport.mockReturnValue({ sendMail });

    await expect(new NodemailerEmailProvider({ to: 'reader@example.com' }).send('# Subject')).resolves.toEqual({
      success: false,
      error: 'auth(...) password=***, denied',
    });

    sendMail.mockRejectedValue('password=raw, auth(user)');
    await expect(new NodemailerEmailProvider({ to: 'reader@example.com' }).send('# Subject')).resolves.toEqual({
      success: false,
      error: 'password=***, auth(...)',
    });
  });
});
