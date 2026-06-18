import { NextResponse } from 'next/server';
import { db } from '@/firebase/config';
import { collection, addDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rating, comment, uid, email, code, type } = body;

    if (!comment && rating === undefined) {
      return NextResponse.json({ error: 'Missing feedback text or rating' }, { status: 400 });
    }

    if (!db) {
      console.error('[feedback] SKIP — Firestore db is null. Check Firebase config env variables.');
      return NextResponse.json({ error: 'Database connection error' }, { status: 500 });
    }

    const feedbackRef = collection(db, 'feedback');
    await addDoc(feedbackRef, {
      rating: rating !== undefined ? Number(rating) : null,
      comment: comment || "",
      uid: uid || null,
      email: email || null,
      code: code || null,
      type: type || 'general',
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[feedback] Error storing feedback:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
