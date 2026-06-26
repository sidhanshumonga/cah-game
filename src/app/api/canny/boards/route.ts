import { NextResponse } from 'next/server';
import { fetchCannyBoards } from '@/utils/canny';

export async function GET() {
  try {
    if (!process.env.CANNY_API_KEY) {
      return NextResponse.json(
        { error: 'Canny is not configured on this server (missing API key).' },
        { status: 503 }
      );
    }

    const boardsData = await fetchCannyBoards();
    return NextResponse.json(boardsData);
  } catch (err: any) {
    console.error('[Canny Boards API] Error listing boards:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
