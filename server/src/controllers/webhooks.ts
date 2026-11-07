import { Request, Response } from 'express';
import { Payment } from '../models/Payment.js';

export async function handlePayPalWebhook(req: Request, res: Response) {
  try {
    const event = req.body;
    const eventType = event?.event_type;
    const resource = event?.resource;

    console.log(`[Webhook] Received PayPal webhook event: ${eventType}`);

    if (!eventType || !resource) {
      return res.status(400).json({ error: 'Missing webhook payload' });
    }

    switch (eventType) {
      case 'PAYMENT.AUTHORIZATION.VOIDED': {
        const authId = resource.id;
        const payment = await Payment.findOne({ paypalAuthorizationId: authId });
        if (payment && payment.status !== 'VOIDED') {
          payment.status = 'VOIDED';
          payment.decision = payment.decision || 'DECLINED';
          payment.decidedAt = payment.decidedAt || new Date();
          await payment.save();
          console.log(`[Webhook] Marked payment ${payment._id} as VOIDED from webhook.`);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.COMPLETED': {
        const parentAuthId = resource.parent_payment;
        if (parentAuthId) {
          const payment = await Payment.findOne({ paypalAuthorizationId: parentAuthId });
          if (payment && payment.status !== 'CAPTURED') {
            payment.status = 'CAPTURED';
            payment.decision = 'APPROVED';
            payment.decidedAt = payment.decidedAt || new Date();
            payment.paypalCaptureId = resource.id;
            await payment.save();
            console.log(`[Webhook] Marked payment ${payment._id} as CAPTURED from webhook.`);
          }
        }
        break;
      }

      default:
        console.log(`[Webhook] Ignored unhandled event type: ${eventType}`);
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[Webhook] Error handling PayPal webhook:', err?.message || err);
    return res.status(500).json({ error: 'Internal webhook error' });
  }
}

