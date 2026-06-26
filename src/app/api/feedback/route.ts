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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[feedback] Error storing feedback:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
