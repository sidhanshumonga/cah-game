import { NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rating, comment, uid, email, code, type } = body;

    if (!comment && rating === undefined) {
      return NextResponse.json({ error: 'Missing feedback text or rating' }, { status: 400 });
    }

    const feedbackRef = adminDb.collection('feedback');
    await feedbackRef.add({
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
