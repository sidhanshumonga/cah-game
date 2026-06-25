import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GAME_DATA } from '@/data/game-data';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token format' }, { status: 401 });
    }

    const idToken = authHeader.substring(7);
    let uid: string;
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch (authErr: any) {
      console.error('[purchase-api] Token verification failed:', authErr.message);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const { itemId, itemType } = await req.json();
    if (!itemId || !itemType || (itemType !== 'pack' && itemType !== 'upgrade')) {
      return NextResponse.json({ error: 'Bad Request: Missing or invalid purchase payload' }, { status: 400 });
    }

    let price = 0;
    let itemName = '';

    // 1. Fetch item details (price & name)
    if (itemType === 'upgrade') {
      const upgrade = GAME_DATA.upgrades.find(u => u.id === itemId);
      if (!upgrade) {
        return NextResponse.json({ error: `Not Found: Upgrade '${itemId}' not found` }, { status: 404 });
      }
      price = upgrade.price;
      itemName = upgrade.name;
    } else {
      // It's a card pack
      const packRef = adminDb.collection('packages').doc(itemId);
      const packSnap = await packRef.get();
      if (!packSnap.exists) {
        return NextResponse.json({ error: `Not Found: Card pack '${itemId}' not found in catalog` }, { status: 404 });
      }
      const packData = packSnap.data() || {};
      if (packData.free) {
        return NextResponse.json({ error: 'Bad Request: Cannot purchase a free pack' }, { status: 400 });
      }
      price = packData.price || 0;
      itemName = packData.name || itemId;
    }

    // 2. Perform database transaction to deduct balance and credit the item
    const userRef = adminDb.collection('users').doc(uid);
    let success = false;
    let errorMessage = '';

    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        errorMessage = 'User profile not found in database';
        return;
      }

      const userData = userSnap.data() || {};
      const currentCredits = userData.credits || 0;
      const ownedPacks = userData.packs || [];
      const ownedUpgrades = userData.upgrades || [];

      // Validation check 1: already owned
      if (itemType === 'pack' && ownedPacks.includes(itemId)) {
        errorMessage = 'You already own this card pack';
        return;
      }
      if (itemType === 'upgrade' && ownedUpgrades.includes(itemId)) {
        errorMessage = 'You already own this upgrade';
        return;
      }

      // Validation check 2: funds
      if (currentCredits < price) {
        errorMessage = `Insufficient funds: item costs ${price} coins, you have ${currentCredits}`;
        return;
      }

      // Deduct credits and update inventory
      const newCredits = currentCredits - price;
      const newPacks = itemType === 'pack' ? [...ownedPacks, itemId] : ownedPacks;
      const newUpgrades = itemType === 'upgrade' ? [...ownedUpgrades, itemId] : ownedUpgrades;
      
      const historyLabel = itemType === 'pack' ? `Pack: ${itemName}` : `Upgrade: ${itemName}`;
      const newHistory = [
        { label: historyLabel, delta: -price, ts: Date.now() },
        ...(userData.history || [])
      ];

      transaction.update(userRef, {
        credits: newCredits,
        packs: newPacks,
        upgrades: newUpgrades,
        history: newHistory,
        updatedAt: FieldValue.serverTimestamp()
      });

      success = true;
    });

    if (!success) {
      return NextResponse.json({ error: errorMessage || 'Transaction failed' }, { status: 400 });
    }

    // 3. Log purchase globally to /purchases for dashboard visibility
    const purchaseId = `${uid}-${Date.now()}`;
    const purchaseRef = adminDb.collection('purchases').doc(purchaseId);
    
    // Get user email safely for logging
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};

    await purchaseRef.set({
      userId: uid,
      userEmail: userData.email || userData.name || 'unknown',
      itemType: itemType,
      itemId: itemId,
      itemName: itemName,
      cost: price,
      currency: 'coins',
      type: 'spend',
      timestamp: Date.now(),
      recordedAt: FieldValue.serverTimestamp()
    });

    console.log(`[purchase-api] SUCCESS — uid: ${uid} bought ${itemType}:${itemId} for ${price} coins.`);
    return NextResponse.json({ success: true, newBalance: userData.credits });

  } catch (e: any) {
    console.error('[purchase-api] Purchase transaction failed:', e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
