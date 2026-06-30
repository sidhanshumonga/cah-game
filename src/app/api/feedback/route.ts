import { NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rating, comment, uid, email, code, type, reasons } = body;

    if (!comment && rating === undefined && (!reasons || reasons.length === 0)) {
      return NextResponse.json({ error: 'Missing feedback text, rating, or reasons' }, { status: 400 });
    }

    const feedbackRef = adminDb.collection('feedback');
    
    // Check if this is a valid post-game feedback for a non-guest user
    let alreadyRewarded = false;
    const isEligibleFeedback = type === 'game-end' || type === 'game-abort';
    const isRealUser = uid && typeof uid === 'string' && !uid.includes('@guest');

    if (isEligibleFeedback && isRealUser && code) {
      const dupCheck = await feedbackRef
        .where('uid', '==', uid)
        .where('code', '==', code)
        .where('type', '==', type)
        .limit(1)
        .get();
      if (!dupCheck.empty) {
        alreadyRewarded = true;
      }
    }

    await feedbackRef.add({
      rating: rating !== undefined ? Number(rating) : null,
      reasons: reasons || [],
      comment: comment || "",
      uid: uid || null,
      email: email || null,
      code: code || null,
      type: type || 'game-end',
      createdAt: new Date().toISOString()
    });

    if (isEligibleFeedback && isRealUser && !alreadyRewarded) {
      const userRef = adminDb.collection('users').doc(uid);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const userData = userDoc.data() || {};
        const currentCredits = Number(userData.credits || 0);
        const currentHistory = Array.isArray(userData.history) ? userData.history : [];
        
        const newCredits = currentCredits + 5;
        const newHistory = [
          {
            label: "Coin top-up (Feedback bonus)",
            delta: 5,
            ts: Date.now()
          },
          ...currentHistory
        ];

        await userRef.update({
          credits: newCredits,
          history: newHistory
        });
        console.log(`[feedback] Credited 5 feedback coins to user ${uid}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[feedback] Error storing feedback:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
