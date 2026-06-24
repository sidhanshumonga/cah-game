import { NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  const action = searchParams.get('action'); // 'query' or 'fix'
  const deductAmount = searchParams.get('deduct'); // number of coins to deduct

  // Simple secret key protection
  if (secret !== 'db-fix-secure-9f37c-2831a') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = 'jeffhodges888@gmail.com';

  try {
    // 1. Find user by email
    const usersRef = adminDb.collection('users');
    const qSnap = await usersRef.where('email', '==', email).get();

    if (qSnap.empty) {
      return NextResponse.json({ message: 'User not found in users collection' });
    }

    let userData: any = null;
    let userId = '';
    qSnap.forEach((doc) => {
      userData = doc.data();
      userId = doc.id;
    });

    // 2. Query purchases for this user
    const purchasesSnap = await adminDb.collection('purchases')
      .where('userId', '==', userId)
      .get();

    const purchases: any[] = [];
    purchasesSnap.forEach((doc) => {
      purchases.push({ id: doc.id, ...doc.data() });
    });

    // If the action is 'fix', we deduct the specified coins and clean up history
    if (action === 'fix' && deductAmount) {
      const coinsToDeduct = parseInt(deductAmount, 10);
      if (isNaN(coinsToDeduct) || coinsToDeduct <= 0) {
        return NextResponse.json({ error: 'Invalid deduct amount' }, { status: 400 });
      }

      const userDocRef = adminDb.collection('users').doc(userId);
      const newCredits = Math.max(0, (userData.credits || 0) - coinsToDeduct);

      // Clean up duplicate top-ups from history if possible
      // (remove the first/latest history item matching "Coin top-up (Stripe)")
      let history = [...(userData.history || [])];
      const matchIndex = history.findIndex((h: any) => h.label === 'Coin top-up (Stripe)' && h.delta === coinsToDeduct);
      if (matchIndex > -1) {
        history.splice(matchIndex, 1);
      }

      await userDocRef.update({
        credits: newCredits,
        history,
        updatedAt: new Date()
      });

      return NextResponse.json({
        message: `Successfully deducted ${coinsToDeduct} coins from user ${email}.`,
        previousCredits: userData.credits,
        newCredits,
        updatedHistory: history,
        purchases
      });
    }

    // Default: just return the query results
    return NextResponse.json({
      userId,
      email,
      credits: userData.credits,
      history: userData.history,
      purchases
    });

  } catch (err: any) {
    console.error('[db-fix] API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
