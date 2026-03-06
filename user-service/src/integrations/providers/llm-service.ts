import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PROMPTS, LogType } from '../../../constants';
import { ConfigService } from '@nestjs/config';
import { TechvLogger } from 'techvedika-logger';

@Injectable()
export class LlmService {
  private genAI: GoogleGenerativeAI;
  constructor(
    private readonly configService: ConfigService,
    private readonly loggerInstance: TechvLogger,
  ) {
    try {
      const apiKey = this.getLlmsApiKey();
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.loggerInstance.logger(LogType.INFO, {
        message: 'LlmService initialized successfully',
        data: {
          service: LlmService.name,
        },
      });
    } catch (error) {
      this.loggerInstance.logger(LogType.ERROR, {
        message: 'Failed to initialize LlmService',
        data: {
          service: LlmService.name,
        },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private getLlmsApiKey(): string {
    const LLM_API_KEY = this.configService.get<string>('LLM_API_KEY');
    if (!LLM_API_KEY) {
      throw new Error('LLM_API_KEY is not configured');
    }
    return LLM_API_KEY;
  }
  private prompt: string = JSON.stringify(PROMPTS);

  private cleanJson(result: string): string {
    return result
      .trim()
      .replace(/^```json/i, '')
      .replace(/^```/, '')
      .replace(/```$/, '')
      .trim();
  }

  /**
   * Classifies multiple emails using Gemini 2.5 Flash
   */
  async classifyEmails(messages: any[], userId: string) {
    this.loggerInstance.logger(LogType.INFO, {
      message: 'Starting classification for emails',
      data: {
        service: LlmService.name,
        method: 'classifyEmails',
        userId,
        emailCount: messages.length,
      },
    });

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
    });

    const results: any[] = [];

    for (const msg of messages) {
      const messageId = msg.id || msg.messageId || 'UNKNOWN_ID';

      const subject = msg.subject;
      const from = msg.from;
      const date = msg.date
        ? new Date(msg.date).toDateString()
        : '[Unknown Date]';
      const decodedText = msg.originalBody || '';
      const snippet = msg.snippet || '';

      let attachmentsInfo = '';
      if (msg.attachments && msg.attachments.length > 0) {
        const attachmentDetails = msg.attachments
          .map((a) => {
            let detail = `\n  - Filename: ${a.filename}`;
            if (a.content) {
              detail += `\n    Content: ${a.content}`;
            } else if (a.data) {
              detail += `\n    Data: ${a.data}`;
            }
            return detail;
          })
          .join('\n');
        attachmentsInfo = `\n\nAttachments (${msg.attachments.length}):${attachmentDetails}`;
      }

      this.loggerInstance.logger(LogType.INFO, {
        message: 'Processing email',
        data: {
          service: LlmService.name,
          method: 'classifyEmails',
          userId,
          messageId,
          hasAttachments: msg.attachments && msg.attachments.length > 0,
        },
      });

      // Avoid rate-limit
      await this.delay(1000);

      let response;
      try {
        response = await model.generateContent(
          `${this.prompt}
          ------------------------------------
          Email Context:
          From: ${from}
          Subject: ${subject}
          Email Sent Date: ${date}
          Snippet: ${snippet}
          ${attachmentsInfo}
          
          Body:
          ${decodedText}`,
        );
      } catch (err) {
        const errorMsg = err.message || String(err);

        if (
          errorMsg.includes('250') ||
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('quota')
        ) {
          this.loggerInstance.logger(LogType.ERROR, {
            message: 'Quota error encountered. Stopping classification',
            data: {
              service: LlmService.name,
              method: 'classifyEmails',
              userId,
              messageId,
            },
            error: errorMsg,
          });
          throw new Error(`LLM Quota Exceeded: ${errorMsg}`);
        }

        this.loggerInstance.logger(LogType.ERROR, {
          message: 'Error calling Gemini. Retrying in 15s',
          data: {
            service: LlmService.name,
            method: 'classifyEmails',
            userId,
            messageId,
          },
          error: errorMsg,
        });

        await this.delay(15000);

        try {
          response = await model.generateContent(
            `${this.prompt}
          ------------------------------------
          Email Context:
          From: ${from}
          Subject: ${subject}
          Email Sent Date: ${date}
          Snippet: ${snippet}
          ${attachmentsInfo}
          
          Body:
          ${decodedText}`,
          );
        } catch (retryErr) {
          const retryErrorMsg = retryErr.message || String(retryErr);

          this.loggerInstance.logger(LogType.ERROR, {
            message: 'Failed to classify email after retry',
            data: {
              service: LlmService.name,
              method: 'classifyEmails',
              userId,
              messageId,
            },
            error: retryErrorMsg,
          });

          if (
            retryErrorMsg.includes('250') ||
            retryErrorMsg.includes('RESOURCE_EXHAUSTED') ||
            retryErrorMsg.includes('quota')
          ) {
            this.loggerInstance.logger(LogType.ERROR, {
              message:
                'Quota error encountered after retry. Stopping classification',
              data: {
                service: LlmService.name,
                method: 'classifyEmails',
                userId,
                messageId,
              },
              error: retryErrorMsg,
            });
            throw new Error(`Something went wrong. Please try again later.`);
          }

          continue;
        }
      }

      if (!response) {
        continue;
      }

      const raw_text = response.response.text();
      const cleaned = this.cleanJson(raw_text);
      const parsed = JSON.parse(cleaned);
      const text = parsed;
      this.loggerInstance.logger(LogType.INFO, {
        message: 'LLM classification result received',
        data: {
          service: LlmService.name,
          method: 'classifyEmails',
          userId,
          messageId,
        },
      });

      results.push({
        messageId,
        classification: text,
      });
    }

    this.loggerInstance.logger(LogType.INFO, {
      message: 'Classification completed',
      data: {
        service: LlmService.name,
        method: 'classifyEmails',
        userId,
        processedCount: results.length,
      },
    });

    return results;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
