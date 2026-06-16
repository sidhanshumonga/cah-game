import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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

    console.log(`[webhook] session id: ${session.id} | uid: ${uid} | coins: ${coins} | db ready: ${!!db}`);

    if (!uid) {
      console.error(`[webhook] SKIP — uid is missing from session metadata. User was probably not logged in via Firebase when checkout started.`);
      return NextResponse.json({ received: true });
    }
    if (coins <= 0) {
      console.error(`[webhook] SKIP — coins value is ${coins}, must be > 0.`);
      return NextResponse.json({ received: true });
    }
    if (!db) {
      console.error(`[webhook] SKIP — Firestore db is null. Check NEXT_PUBLIC_FIREBASE_* env vars are set.`);
      return NextResponse.json({ error: 'Firestore not initialised' }, { status: 500 });
    }

    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        console.error(`[webhook] SKIP — No Firestore document found for uid: ${uid}`);
        return NextResponse.json({ received: true });
      }

      const userData = userSnap.data();
      const currentCredits = userData.credits || 0;
      const currentHistory = userData.history || [];

      await updateDoc(userRef, {
        credits: currentCredits + coins,
        history: [{ label: 'Coin top-up (Stripe)', delta: coins, ts: Date.now() }, ...currentHistory],
        updatedAt: serverTimestamp()
      });

      console.log(`[webhook] SUCCESS — credited ${coins} coins to user ${uid}. New balance: ${currentCredits + coins}`);
    } catch (dbErr) {
      console.error('[webhook] Firestore update failed:', dbErr);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
