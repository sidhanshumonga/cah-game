import { NextResponse } from 'next/server';
import { findOrCreateCannyUser, createCannyVote, deleteCannyVote } from '@/utils/canny';
import { verifyIdToken } from '@/firebase/admin';

// POST: Handles adding or removing a vote on behalf of a user
export async function POST(req: Request) {
  try {
    if (!process.env.CANNY_API_KEY || !process.env.CANNY_SSO_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Canny is not configured on this server (missing API or SSO key).' },
        { status: 503 }
      );
    }

    // 1. Authenticate the request using Firebase Auth Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid token format.' },
        { status: 401 }
      );
    }

    const idToken = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
    } catch (authErr: any) {
      console.error('[Canny Votes API] Auth token verification failed:', authErr.message);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token.' },
        { status: 401 }
      );
    }

    // 2. Enforce that only Google-authenticated users can vote
    const provider = decodedToken.firebase?.sign_in_provider;
    if (provider !== 'google.com') {
      return NextResponse.json(
        { error: 'Forbidden: Only users logged in via Google can vote on feedback.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { postId, vote } = body;

    // Validate inputs
    if (!postId) {
      return NextResponse.json(
        { error: 'Missing required parameter: postId.' },
        { status: 400 }
      );
    }

    if (vote === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameter: vote (boolean).' },
        { status: 400 }
      );
    }

    // 3. Find or create the user in Canny using their Firebase UID as userID
    const cannyUser = await findOrCreateCannyUser({
      userID: decodedToken.uid,
      name: decodedToken.name || decodedToken.email?.split('@')[0] || 'Google User',
      email: decodedToken.email,
      avatarURL: decodedToken.picture || undefined,
    });

    // 4. Perform the vote operation (create or delete)
    let result;
    if (vote) {
      result = await createCannyVote({
        voterID: cannyUser.id,
        postID: postId,
      });
    } else {
      result = await deleteCannyVote({
        voterID: cannyUser.id,
        postID: postId,
      });
    }

    if (result === 'success') {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Canny Votes API] Error processing vote:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
