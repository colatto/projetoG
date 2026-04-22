import { Job } from 'pg-boss';
import { Resend } from 'resend';
import { supabase } from '../supabase.js';

export interface SendEmailJobData {
  notificationLogId: string;
  recipientEmail: string;
  subject: string;
  htmlBody: string;
}

const resend = new Resend(process.env.EMAIL_PROVIDER_API_KEY || 'dummy');
const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'cotacoes@grfincorporadora.com';


export async function processNotificationSendEmail(job: Job<SendEmailJobData>): Promise<void> {
  const { notificationLogId, recipientEmail, subject, htmlBody } = job.data;

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: recipientEmail,
      subject,
      html: htmlBody,
    });

    if (!error) {
      await supabase
        .from('notification_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', notificationLogId);

      // Audit Log
      await supabase.from('audit_logs').insert({
        entity_type: 'notification_logs',
        entity_id: notificationLogId,
        action: 'notification.sent',
        details: { recipient_email: recipientEmail, subject },
      });
    } else {
      await supabase
        .from('notification_logs')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', notificationLogId);

      await supabase.from('audit_logs').insert({
        entity_type: 'notification_logs',
        entity_id: notificationLogId,
        action: 'notification.failed',
        details: { recipient_email: recipientEmail, error: error.message },
      });

      throw new Error(`Email sending failed: ${error.message}`);
    }
  } catch (err: any) {
    console.error('Failed to process notification email job', {
      jobId: job.id,
      error: err.message,
    });
    throw err;
  }
}
