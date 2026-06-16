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
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.metadata?.uid;
    const coins = session.metadata?.coins ? parseInt(session.metadata.coins, 10) : 0;

    if (uid && coins > 0) {
      try {
        // Increment coins directly in Firestore
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const currentCredits = userData.credits || 0;
          const currentHistory = userData.history || [];
          
          const label = `Coin top-up (Stripe)`;
          const newHistoryItem = {
            label,
            delta: coins,
            ts: Date.now()
          };

          await updateDoc(userRef, {
            credits: currentCredits + coins,
            history: [newHistoryItem, ...currentHistory],
            updatedAt: serverTimestamp()
          });
          console.log(`Successfully credited ${coins} coins to user ${uid}`);
        } else {
          console.error(`User profile document not found for uid: ${uid}`);
        }
      } catch (dbErr) {
        console.error('Failed to update user credits in Firestore:', dbErr);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
