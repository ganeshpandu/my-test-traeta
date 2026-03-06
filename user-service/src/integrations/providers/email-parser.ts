import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import * as quopri from 'quoted-printable';

@Injectable()
export class EmailParserService {
  private MAX_BODY_LEN = 5000;

  private safeBase64Decode(input?: string): Buffer | null {
    if (!input) return null;

    try {
      let s = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
      const pad = s.length % 4;
      if (pad) s += '='.repeat(4 - pad);

      return Buffer.from(s, 'base64');
    } catch {
      try {
        return Buffer.from(input, 'base64');
      } catch {
        return null;
      }
    }
  }

  private decodeTextData(raw?: string): string | null {
    if (!raw) return null;

    const b = this.safeBase64Decode(raw);
    if (b) {
      try {
        return b.toString('utf-8');
      } catch {
        try {
          return b.toString('latin1');
        } catch {
          /* ignore */
        }
      }
    }

    // fallback: quoted printable
    try {
      const qp = quopri.decode(raw);
      return qp.toString('utf-8') || qp.toString('latin1');
    } catch {
      return null;
    }
  }

  private cleanHtml(html: string): string {
    try {
      const $ = cheerio.load(html);
      return $('*').text().trim();
    } catch {
      return html.replace(/<[^>]+>/g, '').trim();
    }
  }

  private extractHeaders(payload: any): Record<string, string> {
    const headers: Record<string, string> = {};
    (payload.headers || []).forEach((h: any) => {
      headers[(h.name || '').toLowerCase()] = h.value || '';
    });
    return headers;
  }

  private extractBody(payload: any): { body: string; original: string } {
    let foundText: string | null = null;
    let foundHtml: string | null = null;

    const walk = (p: any) => {
      if (!p) return;
      if (foundText) return; // stop early if plain-text found

      const body = p.body || {};
      const data = body.data;
      const mime = (p.mimeType || '').toLowerCase();

      if (data) {
        const decoded = this.decodeTextData(data) || '';

        if (mime === 'text/plain' && !foundText) {
          foundText = decoded;
        } else if (mime === 'text/html' && !foundHtml) {
          foundHtml = decoded;
        }
      }

      if (p.parts) {
        for (const sub of p.parts) {
          if (!foundText) walk(sub);
        }
      }
    };

    walk(payload);

    if (foundText) {
      return {
        body: foundText.slice(0, this.MAX_BODY_LEN),
        original: foundText,
      };
    }

    if (foundHtml) {
      return {
        body: this.cleanHtml(foundHtml).slice(0, this.MAX_BODY_LEN),
        original: foundHtml,
      };
    }

    const fallback = this.decodeTextData(payload?.body?.data) || '';
    return { body: fallback, original: fallback };
  }

  private extractAttachments(parts: any[]): any[] {
    const attachments: any[] = [];

    const walk = (list: any[]) => {
      for (const part of list) {
        const filename = part.filename || '';
        const body = part.body || {};
        const data = body.data;
        const mime = part.mimeType || '';
        const size = body.size || 0;

        if (filename) {
          attachments.push({
            filename,
            mimeType: mime,
            size,
            attachmentId: body.attachmentId,
          });
        } else if (!mime.startsWith('text') && data) {
          const buf = this.safeBase64Decode(data);
          attachments.push({
            filename: 'inline.bin',
            mimeType: mime,
            size: buf ? buf.length : size,
            attachmentId: body.attachmentId,
          });
        }

        if (part.parts) walk(part.parts);
      }
    };

    walk(parts || []);
    return attachments;
  }

  parseEmailMessage(message: any, labelIds?: string[]) {
    const payload = message.payload || {};
    const headers = this.extractHeaders(payload);

    const subject = headers['subject'] || '';
    const from = headers['from'] || '';
    const to = headers['to'] || '';

    // Date parsing
    let date: Date | null = null;

    if (headers['date']) {
      try {
        date = new Date(headers['date']);
      } catch {}
    }

    if (!date && message.internalDate) {
      try {
        date = new Date(Number(message.internalDate));
      } catch {}
    }

    const bodyData = this.extractBody(payload);
    const snippet =
      message.snippet || (bodyData.body ? bodyData.body.substring(0, 200) : '');

    const attachments = this.extractAttachments(payload.parts || []);

    return {
      id: message.id,
      subject,
      from,
      to,
      date,
      body: bodyData.body,
      originalBody: bodyData.original,
      snippet,
      labels: labelIds || message.labelIds || [],
      attachments,
    };
  }
}
