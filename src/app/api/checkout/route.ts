import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyIdToken } from '@/firebase/admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia' as any,
});

function getBundlePrice(coins: number, currency: string): { amount: number; currency: string } {
  const c = currency.toLowerCase();
  
  if (coins === 500) {
    if (c === 'inr') return { amount: 19900, currency: 'inr' };
    if (c === 'gbp') return { amount: 399, currency: 'gbp' };
    if (c === 'aed') return { amount: 1899, currency: 'aed' };
    return { amount: 499, currency: 'usd' };
  }
  
  if (coins === 1200) {
    if (c === 'inr') return { amount: 39900, currency: 'inr' };
    if (c === 'gbp') return { amount: 799, currency: 'gbp' };
    if (c === 'aed') return { amount: 3699, currency: 'aed' };
    return { amount: 999, currency: 'usd' };
  }
  
  if (coins === 3000) {
    if (c === 'inr') return { amount: 79900, currency: 'inr' };
    if (c === 'gbp') return { amount: 1599, currency: 'gbp' };
    if (c === 'aed') return { amount: 7299, currency: 'aed' };
    return { amount: 1999, currency: 'usd' };
  }

  return { amount: 499, currency: 'usd' };
}

export async function POST(req: Request) {
  try {
    const { productId, coins, uid, email, currency } = await req.json();

    if (!productId || !coins) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const isFirebaseEnabled = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    let targetUid = uid;
    let targetEmail = email || '';

    if (isFirebaseEnabled) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
      }
      const idToken = authHeader.substring(7);
      try {
        const decodedToken = await verifyIdToken(idToken);
        targetUid = decodedToken.uid;
        targetEmail = decodedToken.email || '';
      } catch (authErr: any) {
        console.error('[checkout-api] Token verification failed:', authErr.message);
        return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
      }
    }

    if (!targetUid) {
      return NextResponse.json({ error: 'Bad Request: Missing user identity' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    let targetProductId = productId;
    if (isLocalhost) {
      if (productId === 'prod_UiU1bLVVTs3WEp' || productId === 'prod_UiU1NqbXoVoF78' || productId === 'prod_UiU2mxisRKNBys') {
        targetProductId = 'prod_UiUOA82wjWJ8Zg';
      }
    }

    // Get the exact localized price amount and currency corresponding to what we display on the website
    const bundlePrice = getBundlePrice(Number(coins), currency || 'usd');

    // Create the Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: bundlePrice.currency,
            product: targetProductId,
            unit_amount: bundlePrice.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: targetEmail || undefined,
      metadata: {
        uid: targetUid,
        coins: String(coins),
      },
      success_url: `${origin}/coins?success=true`,
      cancel_url: `${origin}/coins?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error('Stripe checkout session creation failed:', e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
