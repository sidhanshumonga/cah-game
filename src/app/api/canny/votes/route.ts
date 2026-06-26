import { NextResponse } from 'next/server';
import { signCannyJWT, createCannyVote, deleteCannyVote } from '@/utils/canny';
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

    // 3. Construct Canny user object from verified token claims
    const user = {
      id: decodedToken.uid,
      name: decodedToken.name || decodedToken.email?.split('@')[0] || 'Google User',
      email: decodedToken.email,
      avatarURL: decodedToken.picture || undefined,
    };

    // 4. Generate SSO JWT token for user
    const authorToken = await signCannyJWT(user);

    // 5. Perform the vote operation (create or delete)
    let result;
    if (vote) {
      result = await createCannyVote({
        authorToken,
        postId,
      });
    } else {
      result = await deleteCannyVote({
        authorToken,
        postId,
      });
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
