import { NextResponse } from 'next/server';
import { listCannyComments, findOrCreateCannyUser, createCannyComment } from '@/utils/canny';
import { verifyIdToken } from '@/firebase/admin';

// GET: Lists comments for a post
export async function GET(req: Request) {
  try {
    if (!process.env.CANNY_API_KEY) {
      return NextResponse.json(
        { error: 'Canny is not configured on this server (missing API key).' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json(
        { error: 'Missing required parameter: postId.' },
        { status: 400 }
      );
    }

    const commentsData = await listCannyComments({ postId });
    return NextResponse.json(commentsData);
  } catch (err: any) {
    console.error('[Canny Comments API] Error listing comments:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: Creates a new comment on behalf of a Google-authenticated user
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
      console.error('[Canny Comments API] Auth token verification failed:', authErr.message);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token.' },
        { status: 401 }
      );
    }

    // 2. Enforce that only Google-authenticated users can comment
    const provider = decodedToken.firebase?.sign_in_provider;
    if (provider !== 'google.com') {
      return NextResponse.json(
        { error: 'Forbidden: Only users logged in via Google can post comments.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { postId, value } = body;

    // Validate inputs
    if (!postId || !value || !value.trim()) {
      return NextResponse.json(
        { error: 'Missing required parameters: postId and value (comment text).' },
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

    // 4. Submit the comment to Canny
    const createdComment = await createCannyComment({
      authorID: cannyUser.id,
      postID: postId,
      value: value.trim(),
    });

    return NextResponse.json(createdComment);
  } catch (err: any) {
    console.error('[Canny Comments API] Error creating comment:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
