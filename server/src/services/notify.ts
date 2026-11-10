export interface NotificationPayload {
  familyId: string;
  elderName?: string;
  payeeLabel: string;
  amount: number;
  risk: string;
  holdToken: string;
  familySummary?: string;
}

export async function notifyFamilyOfHold(payload: NotificationPayload): Promise<void> {
  const { elderName, payeeLabel, amount, risk, holdToken, familySummary } = payload;
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  const approverLink = `${appBaseUrl}/?role=family`;

  const message = `[Second Sight Alert] A ${risk}-risk payment of $${amount.toFixed(
    2
  )} from ${elderName || 'your elder'} to "${payeeLabel}" was paused for review. Summary: ${
    familySummary || 'Needs review'
  }. Approve or decline: ${approverLink}`;

  console.log('----------------------------------------------------');
  console.log('🔔 FAMILY NOTIFICATION TRIGGERED:');
  console.log(message);
  console.log('----------------------------------------------------');

  // If Twilio or email environment variables are provided in future, send actual SMS/Email here
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const familyPhone = process.env.FAMILY_NOTIFICATION_PHONE;

  if (twilioSid && twilioToken && twilioFrom && familyPhone) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const body = new URLSearchParams({
        From: twilioFrom,
        To: familyPhone,
        Body: message,
      });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        console.error('[Notify] Failed to dispatch Twilio SMS alert:', res.statusText);
      }
    } catch (err: any) {
      console.error('[Notify] Twilio dispatch error:', err.message);
    }
  }
}

