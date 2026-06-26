import { NextResponse } from 'next/server';
import { listCannyPosts, findOrCreateCannyUser, createCannyPost } from '@/utils/canny';
import { verifyIdToken } from '@/firebase/admin';

// GET: Lists feedback posts from Canny
export async function GET(req: Request) {
  try {
    if (!process.env.CANNY_API_KEY) {
      return NextResponse.json(
        { error: 'Canny is not configured on this server (missing API key).' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const boardId = searchParams.get('boardId') || undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const skip = searchParams.get('skip') ? Number(searchParams.get('skip')) : undefined;
    const sort = (searchParams.get('sort') as any) || undefined;
    const search = searchParams.get('search') || undefined;

    const postsData = await listCannyPosts({
      boardId,
      limit,
      skip,
      sort,
      search,
    });

    return NextResponse.json(postsData);
  } catch (err: any) {
    console.error('[Canny Posts API] Error listing posts:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: Creates a new post on behalf of an authenticated Google user
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
      console.error('[Canny Posts API] Auth token verification failed:', authErr.message);
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token.' },
        { status: 401 }
      );
    }

    // 2. Enforce that only Google-authenticated users can post feedback
    const provider = decodedToken.firebase?.sign_in_provider;
    if (provider !== 'google.com') {
      return NextResponse.json(
        { error: 'Forbidden: Only users logged in via Google can submit feedback.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, details, boardId } = body;

    // Validate inputs
    if (!title || !details) {
      return NextResponse.json(
        { error: 'Missing required post parameters (title and details).' },
        { status: 400 }
      );
    }

    const targetBoardId = boardId || process.env.CANNY_DEFAULT_BOARD_ID;
    if (!targetBoardId) {
      return NextResponse.json(
        { error: 'Missing boardId. Provide boardId in payload or define CANNY_DEFAULT_BOARD_ID on server.' },
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

    // 4. Submit the post to Canny using Canny user ID
    const createdPost = await createCannyPost({
      authorID: cannyUser.id,
      title,
      details,
      boardID: targetBoardId,
    });

    return NextResponse.json(createdPost);
  } catch (err: any) {
    console.error('[Canny Posts API] Error creating post:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
