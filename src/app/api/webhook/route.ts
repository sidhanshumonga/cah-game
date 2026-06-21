import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed:`, err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  console.log(`[webhook] received event type: ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.metadata?.uid;
    const coins = session.metadata?.coins ? parseInt(session.metadata.coins, 10) : 0;

    console.log(`[webhook] session id: ${session.id} | uid: ${uid} | coins: ${coins}`);

    if (!uid) {
      console.error(`[webhook] SKIP — uid is missing from session metadata. User was probably not logged in via Firebase when checkout started.`);
      return NextResponse.json({ received: true });
    }
    if (coins <= 0) {
      console.error(`[webhook] SKIP — coins value is ${coins}, must be > 0.`);
      return NextResponse.json({ received: true });
    }

    try {
      const userRef = adminDb.collection('users').doc(uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        console.error(`[webhook] SKIP — No Firestore document found for uid: ${uid}`);
        return NextResponse.json({ received: true });
      }

      const userData = userSnap.data() || {};
      const currentCredits = userData.credits || 0;
      const currentHistory = userData.history || [];

      await userRef.update({
        credits: currentCredits + coins,
        history: [{ label: 'Coin top-up (Stripe)', delta: coins, ts: Date.now() }, ...currentHistory],
        updatedAt: FieldValue.serverTimestamp()
      });

      // Log payment transaction globally to /purchases for analytics
      const purchaseRef = adminDb.collection('purchases').doc(session.id);
      const paidAmount = session.amount_total ? session.amount_total / 100 : 0;
      const payCurrency = (session.currency || 'usd').toUpperCase();
      
      await purchaseRef.set({
        userId: uid,
        userEmail: session.customer_details?.email || session.customer_email || userData.email || userData.name || 'Unknown',
        itemType: 'coins',
        itemId: `coins-${coins}`,
        itemName: `${coins} Coins Bundle`,
        cost: paidAmount,
        currency: payCurrency,
        coinsAwarded: coins,
        stripeSessionId: session.id,
        type: 'top-up',
        timestamp: Date.now(),
        recordedAt: FieldValue.serverTimestamp()
      });

      console.log(`[webhook] SUCCESS — credited ${coins} coins to user ${uid}. New balance: ${currentCredits + coins} and logged purchase.`);
    } catch (dbErr) {
      console.error('[webhook] Firestore update failed:', dbErr);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

