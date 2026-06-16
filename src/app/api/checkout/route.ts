import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia' as any,
});

export async function POST(req: Request) {
  try {
    const { productId, coins, uid, email } = await req.json();

    if (!productId || !coins || !uid) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    let targetProductId = productId;
    if (isLocalhost && productId === 'prod_UiU1bLVVTs3WEp') {
      targetProductId = 'prod_UiU76M9vEFVwP6';
    }

    // 1. Retrieve the product with default price expanded
    const product = await stripe.products.retrieve(targetProductId, {
      expand: ['default_price'],
    });
    const defaultPrice = product.default_price as Stripe.Price;

    if (!defaultPrice) {
      return NextResponse.json({ error: 'Stripe product has no default price configured' }, { status: 400 });
    }

    const priceId = defaultPrice.id;
    const mode = (defaultPrice.type === 'recurring' || !!defaultPrice.recurring) ? 'subscription' : 'payment';

    // 2. Create the Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode as Stripe.Checkout.SessionCreateParams.Mode,
      customer_email: email || undefined,
      metadata: {
        uid,
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
