import sgMail from "@sendgrid/mail";

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@example.com";

export type NotificationType =
  | "SIGNER_ACTIVATED"
  | "AFE_FULLY_SIGNED"
  | "AFE_REJECTED"
  | "REMINDER";

interface NotificationData {
  afeName: string;
  afeId: string;
  signerName?: string;
  rejectedBy?: string;
  rejectReason?: string;
  pdfBuffer?: Buffer;
  pdfFilename?: string;
}

/**
 * Send a notification email
 */
export async function sendNotification(
  type: NotificationType,
  to: string,
  data: NotificationData
): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[Email] Would send ${type} to ${to}:`, data);
    return;
  }

  const signUrl = `${APP_URL}/afe/${data.afeId}`;
  let subject: string;
  let html: string;

  switch (type) {
    case "SIGNER_ACTIVATED":
      subject = `Action Required: AFE "${data.afeName}" Awaiting Your Signature`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">AFE Awaiting Your Signature</h2>
          <p>Hello,</p>
          <p>The AFE <strong>"${data.afeName}"</strong> is ready for your review and signature.</p>
          <p style="margin: 24px 0;">
            <a href="${signUrl}"
               style="background-color: #0066cc; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              Review and Sign
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            This is an automated message from the AFE Approval System.
          </p>
        </div>
      `;
      break;

    case "AFE_FULLY_SIGNED":
      subject = `AFE "${data.afeName}" Has Been Fully Signed`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">AFE Fully Signed</h2>
          <p>Hello,</p>
          <p>The AFE <strong>"${data.afeName}"</strong> has been signed by all required parties.</p>
          <p>The final signed document is now available for download.</p>
          <p style="margin: 24px 0;">
            <a href="${signUrl}"
               style="background-color: #28a745; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              View Signed Document
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            This is an automated message from the AFE Approval System.
          </p>
        </div>
      `;
      break;

    case "AFE_REJECTED":
      subject = `AFE "${data.afeName}" Has Been Rejected`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">AFE Rejected</h2>
          <p>Hello,</p>
          <p>The AFE <strong>"${data.afeName}"</strong> has been rejected by ${data.rejectedBy || "a signer"}.</p>
          ${data.rejectReason ? `<p><strong>Reason:</strong> ${data.rejectReason}</p>` : ""}
          <p style="margin: 24px 0;">
            <a href="${signUrl}"
               style="background-color: #666; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              View Details
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            This is an automated message from the AFE Approval System.
          </p>
        </div>
      `;
      break;

    case "REMINDER":
      subject = `Reminder: AFE "${data.afeName}" Awaiting Your Signature`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff9800;">Reminder: Signature Required</h2>
          <p>Hello,</p>
          <p>This is a reminder that the AFE <strong>"${data.afeName}"</strong> is still awaiting your signature.</p>
          <p style="margin: 24px 0;">
            <a href="${signUrl}"
               style="background-color: #0066cc; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 4px; display: inline-block;">
              Review and Sign
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            This is an automated message from the AFE Approval System.
          </p>
        </div>
      `;
      break;
  }

  try {
    const msg: sgMail.MailDataRequired = {
      to,
      from: FROM_EMAIL,
      subject,
      html,
    };

    // Add PDF attachment if provided
    if (data.pdfBuffer && data.pdfFilename) {
      msg.attachments = [
        {
          content: data.pdfBuffer.toString("base64"),
          filename: data.pdfFilename,
          type: "application/pdf",
          disposition: "attachment",
        },
      ];
    }

    await sgMail.send(msg);
    console.log(`[Email] Sent ${type} to ${to}${data.pdfBuffer ? " (with attachment)" : ""}`);
  } catch (error) {
    console.error(`[Email] Failed to send ${type} to ${to}:`, error);
    // Don't throw - email failure shouldn't break the main flow
  }
}

/**
 * Send notification to multiple recipients
 */
export async function sendBulkNotification(
  type: NotificationType,
  recipients: string[],
  data: NotificationData
): Promise<void> {
  await Promise.all(
    recipients.map((to) => sendNotification(type, to, data))
  );
}
