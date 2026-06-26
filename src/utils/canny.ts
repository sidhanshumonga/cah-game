import * as jose from 'jose';

const CANNY_API_BASE = 'https://canny.io/api/v1';

export interface CannyUser {
  id: string;
  name: string;
  email?: string;
  avatarURL?: string;
}

/**
 * Signs a user profile into a JSON Web Token (JWT) using the Canny SSO private key.
 * This is used to authenticate users securely with Canny's API (e.g. for posting or voting).
 */
export async function signCannyJWT(user: CannyUser): Promise<string> {
  const ssoKey = process.env.CANNY_SSO_PRIVATE_KEY;
  if (!ssoKey) {
    throw new Error('CANNY_SSO_PRIVATE_KEY is not defined in environment variables');
  }

  const secret = new TextEncoder().encode(ssoKey);

  const payload: Record<string, any> = {
    id: user.id,
    name: user.name,
  };
  if (user.email) payload.email = user.email;
  if (user.avatarURL) payload.avatarURL = user.avatarURL;

  return await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secret);
}

/**
 * Performs a secure server-to-server POST request to the Canny API.
 * Automatically injects the CANNY_API_KEY secret.
 */
export async function cannyRequest(endpoint: string, payload: Record<string, any> = {}) {
  const apiKey = process.env.CANNY_API_KEY;
  if (!apiKey) {
    throw new Error('CANNY_API_KEY is not defined in environment variables');
  }

  const url = `${CANNY_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey,
      ...payload,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[Canny API Error] Endpoint ${endpoint} returned status ${response.status}:`, errText);
    throw new Error(`Canny API request failed: ${errText || response.statusText}`);
  }

  return response.json();
}

/**
 * Retrieves a list of active boards for the authenticated Canny account.
 */
export async function fetchCannyBoards() {
  return cannyRequest('/boards/list');
}

/**
 * Lists feedback posts from Canny, with optional board filtering, sorting, limits, and searching.
 */
export async function listCannyPosts(params: {
  boardId?: string;
  limit?: number;
  skip?: number;
  sort?: 'top' | 'newest' | 'oldest' | 'trending';
  search?: string;
}) {
  return cannyRequest('/posts/list', params);
}

/**
 * Submits a new feedback post (e.g. bug or feature request) to Canny on behalf of a user.
 */
export async function createCannyPost(params: {
  authorToken: string;
  title: string;
  details: string;
  boardId: string;
}) {
  return cannyRequest('/posts/create', {
    authorToken: params.authorToken,
    title: params.title,
    details: params.details,
    boardId: params.boardId,
  });
}

/**
 * Adds an upvote to a post on behalf of a user.
 */
export async function createCannyVote(params: {
  authorToken: string;
  postId: string;
}) {
  return cannyRequest('/votes/create', {
    authorToken: params.authorToken,
    postId: params.postId,
  });
}

/**
 * Removes an upvote from a post on behalf of a user.
 */
export async function deleteCannyVote(params: {
  authorToken: string;
  postId: string;
}) {
  return cannyRequest('/votes/delete', {
    authorToken: params.authorToken,
    postId: params.postId,
  });
}

/**
 * Lists comments for a specific post.
 */
export async function listCannyComments(params: {
  postId: string;
  limit?: number;
  skip?: number;
}) {
  return cannyRequest('/comments/list', params);
}

/**
 * Creates a comment on a post on behalf of a user.
 */
export async function createCannyComment(params: {
  authorToken: string;
  postId: string;
  value: string;
}) {
  return cannyRequest('/comments/create', {
    authorToken: params.authorToken,
    postId: params.postId,
    value: params.value,
  });
}
