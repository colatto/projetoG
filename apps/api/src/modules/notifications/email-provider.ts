import { Resend } from 'resend';

export interface EmailProvider {
  send(
    to: string | string[],
    subject: string,
    htmlBody: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export class ResendEmailProvider implements EmailProvider {
  private resend: Resend;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress: string) {
    this.resend = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  async send(
    to: string | string[],
    subject: string,
    htmlBody: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html: htmlBody,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Unknown error' };
    }
  }
}
