/**
 * Firestore helper functions for Point Blank
 * Handles users, packages, and real-time game rooms.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  addDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';

// ─────────────────────────────────────────────
// USER PROFILES
// ─────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<any | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  } catch (e) {
    console.error('getUserProfile failed', e);
    return null;
  }
}

export async function getAllUsers(): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    console.error('getAllUsers failed', e);
    return [];
  }
}

export async function setUserProfile(uid: string, data: any): Promise<void> {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.error('setUserProfile failed', e);
  }
}

export async function updateUserProfile(uid: string, partial: any): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'users', uid), { ...partial, updatedAt: serverTimestamp() });
  } catch (e) {
    console.error('updateUserProfile failed', e);
  }
}

export function subscribeUserProfile(uid: string, callback: (profile: any | null) => void): Unsubscribe | null {
  if (!db) return null;
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (snap.exists()) {
      callback({ uid, ...snap.data() });
    } else {
      callback(null);
    }
  });
}

// ─────────────────────────────────────────────
// PACKAGES (admin-seeded card packs)
// ─────────────────────────────────────────────

export async function getPackages(): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'packages'));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('getPackages failed', e);
    return [];
  }
}

export function subscribePackages(callback: (packs: any[]) => void): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(collection(db, 'packages'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function seedPackage(pack: any, adminUid: string): Promise<string | null> {
  if (!db) return null;
  try {
    const packId = pack.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await setDoc(doc(db, 'packages', packId), {
      ...pack,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
    });
    return packId;
  } catch (e) {
    console.error('seedPackage failed', e);
    return null;
  }
}

export async function deletePackage(packId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'packages', packId));
  } catch (e) {
    console.error('deletePackage failed', e);
  }
}

// ─────────────────────────────────────────────
// ROOMS
// ─────────────────────────────────────────────

export async function createRoom(
  code: string,
  hostUid: string,
  hostName: string,
  settings: any
): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'rooms', code), {
    code,
    hostUid,
    hostName,
    status: 'lobby',
    settings,
    createdAt: serverTimestamp(),
  });
}

export async function getRoomDoc(code: string): Promise<any | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'rooms', code));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

export async function verifyRoom(code: string): Promise<{
  valid: boolean;
  error?: 'not_found' | 'in_progress' | 'ended' | 'full';
  settings?: any;
}> {
  if (!db) return { valid: false };
  try {
    const roomSnap = await getDoc(doc(db, 'rooms', code));
    if (!roomSnap.exists()) {
      return { valid: false, error: 'not_found' };
    }
    const roomData = roomSnap.data();
    if (roomData.status === 'ended' || roomData.status === 'completed') {
      return { valid: false, error: 'ended' };
    }
    if (roomData.status !== 'lobby') {
      return { valid: false, error: 'in_progress' };
    }
    const playersSnap = await getDocs(collection(db, 'rooms', code, 'players'));
    const playersCount = playersSnap.size;
    const maxPlayers = roomData.settings?.maxPlayers || 10;
    if (playersCount >= maxPlayers) {
      return { valid: false, error: 'full' };
    }
    return { valid: true, settings: roomData.settings };
  } catch (e) {
    console.error('verifyRoom failed', e);
    return { valid: false };
  }
}

export async function updateRoom(code: string, partial: any): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'rooms', code), partial);
}

export async function resetRoomForReplay(code: string, hostUid: string): Promise<void> {
  if (!db) return;
  try {
    // 1. Update room status to 'lobby'
    await updateDoc(doc(db, 'rooms', code), {
      status: 'lobby',
    });

    // 2. Delete game state
    await deleteDoc(doc(db, 'rooms', code, 'gameState', 'current'));

    // 3. Reset and clean up players
    const playersRef = collection(db, 'rooms', code, 'players');
    const playersSnap = await getDocs(playersRef);
    for (const playerDoc of playersSnap.docs) {
      const pData = playerDoc.data();
      if (pData.left || pData.isConnected === false) {
        await deleteDoc(playerDoc.ref);
      } else {
        const isHost = pData.uid === hostUid;
        await updateDoc(playerDoc.ref, {
          score: 0,
          ready: isHost,
        });
      }
    }
  } catch (e) {
    console.error('resetRoomForReplay failed', e);
  }
}

export function subscribeRoom(code: string, callback: (data: any | null) => void): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'rooms', code), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

// ─────────────────────────────────────────────
// ROOM PLAYERS
// ─────────────────────────────────────────────

export async function joinRoom(code: string, player: {
  uid: string; name: string; color: string; isHost: boolean;
}): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'rooms', code, 'players', player.uid), {
    ...player,
    score: 0,
    ready: player.isHost,
    isConnected: true,
    joinedAt: serverTimestamp(),
  });
}

export async function updatePlayerConnection(code: string, uid: string, isConnected: boolean): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'rooms', code, 'players', uid), { isConnected });
  } catch (e) {
    // ignore
  }
}

export async function updatePlayerReady(code: string, uid: string, ready: boolean): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'rooms', code, 'players', uid), { ready });
}

export async function leaveRoom(code: string, uid: string, softLeave?: boolean): Promise<void> {
  if (!db) return;
  try {
    if (softLeave) {
      await updateDoc(doc(db, 'rooms', code, 'players', uid), {
        left: true,
        isConnected: false,
      });
    } else {
      await deleteDoc(doc(db, 'rooms', code, 'players', uid));
    }
  } catch (e) {
    console.error('leaveRoom failed', e);
  }
}

export async function kickPlayer(code: string, uid: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, 'rooms', code, 'players', uid));
}

export function subscribeRoomPlayers(
  code: string,
  callback: (players: any[]) => void
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(collection(db, 'rooms', code, 'players'), (snap) => {
    const players = snap.docs.map((d) => d.data());
    // Sort: host first, then by joinedAt
    players.sort((a, b) => {
      if (a.isHost) return -1;
      if (b.isHost) return 1;
      return 0;
    });
    callback(players);
  });
}

// ─────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────

export async function sendChatMessage(
  code: string,
  uid: string,
  name: string,
  color: string,
  text: string
): Promise<void> {
  if (!db) return;
  await addDoc(collection(db, 'rooms', code, 'chat'), {
    uid, name, color, text,
    ts: serverTimestamp(),
  });
}

export function subscribeRoomChat(
  code: string,
  callback: (msgs: any[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, 'rooms', code, 'chat'), orderBy('ts', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// ─────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────

export async function startGame(
  code: string,
  round: number,
  prompt: string,
  judgeUid: string,
  judgeOrder: string[],
  scores: Record<string, number>
): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'rooms', code, 'gameState', 'current'), {
    round,
    prompt,
    phase: 'pick',
    judgeUid,
    judgeOrder,
    originalPlayers: judgeOrder, // STABLE LIST FOR CARD DRAW POOLS
    submissions: [],
    winnerUid: null,
    scores,
    updatedAt: serverTimestamp(),
  });
}

export async function submitCard(
  code: string,
  uid: string,
  name: string,
  text: string
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'rooms', code, 'gameState', 'current'), {
    submissions: arrayUnion({ uid, name, text }),
    updatedAt: serverTimestamp(),
  });
}

export async function updateGameState(code: string, partial: any): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'rooms', code, 'gameState', 'current'), {
    ...partial,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeGameState(
  code: string,
  callback: (state: any | null) => void
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'rooms', code, 'gameState', 'current'), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function sendReaction(code: string, emoji: string, name: string): Promise<void> {
  if (!db) return;
  await addDoc(collection(db, 'rooms', code, 'reactions'), {
    emoji,
    name,
    ts: serverTimestamp(),
  });
}

export function subscribeReactions(
  code: string,
  callback: (reaction: { emoji: string; name: string }) => void
): Unsubscribe {
  if (!db) return () => {};
  const startMs = Date.now();
  return onSnapshot(collection(db, 'rooms', code, 'reactions'), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        const reactionTs = data.ts?.toMillis() || Date.now();
        if (reactionTs >= startMs - 2000) {
          callback({ emoji: data.emoji, name: data.name || '' });
        }
      }
    });
  });
}

// ─────────────────────────────────────────────
// PURCHASES & ANALYTICS
// ─────────────────────────────────────────────

export async function logPurchase(purchase: {
  userId: string;
  userEmail: string;
  itemType: 'coins' | 'pack' | 'upgrade' | 'other';
  itemId: string;
  itemName: string;
  cost: number;
  currency: string;
  coinsAwarded?: number;
  stripeSessionId?: string;
  type: 'top-up' | 'spend';
  timestamp: number;
}): Promise<void> {
  if (!db) return;
  try {
    const purchaseId = purchase.stripeSessionId && purchase.stripeSessionId !== 'legacy'
      ? purchase.stripeSessionId
      : `${purchase.userId}-${purchase.timestamp}-${Math.abs(purchase.cost)}`;
    
    await setDoc(doc(db, 'purchases', purchaseId), {
      ...purchase,
      recordedAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('logPurchase failed', e);
  }
}

export async function getPurchases(): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'purchases'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('getPurchases failed', e);
    return [];
  }
}

export async function migrateExistingPurchases(): Promise<number> {
  if (!db) return 0;
  try {
    let migratedCount = 0;
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const uid = userDoc.id;
      const history = userData.history || [];
      for (const entry of history) {
        if (!entry.label || entry.delta === undefined) continue;
        
        const purchaseId = `${uid}-${entry.ts}-${Math.abs(entry.delta)}`;
        const docRef = doc(db, 'purchases', purchaseId);
        const snap = await getDoc(docRef);
        
        if (!snap.exists()) {
          let purchaseData: any = null;
          
          if (entry.label.includes("Coin top-up")) {
            const coins = Math.abs(entry.delta);
            let approxPrice = 0;
            // 500 coins -> $4.99 USD
            // 1200 coins -> $9.99 USD
            // 3000 coins -> $19.99 USD
            if (coins === 500) approxPrice = 4.99;
            else if (coins === 1200) approxPrice = 9.99;
            else if (coins === 3000) approxPrice = 19.99;
            
            purchaseData = {
              userId: uid,
              userEmail: userData.email || userData.name || "Unknown",
              itemType: 'coins',
              itemId: `coins-${coins}`,
              itemName: entry.label,
              cost: approxPrice,
              currency: 'USD',
              coinsAwarded: coins,
              stripeSessionId: 'legacy',
              type: 'top-up',
              timestamp: entry.ts || Date.now()
            };
          } else if (entry.label.startsWith("Pack: ")) {
            const packName = entry.label.replace("Pack: ", "");
            purchaseData = {
              userId: uid,
              userEmail: userData.email || userData.name || "Unknown",
              itemType: 'pack',
              itemId: packName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              itemName: packName,
              cost: Math.abs(entry.delta),
              currency: 'coins',
              type: 'spend',
              timestamp: entry.ts || Date.now()
            };
          } else if (entry.label.startsWith("Upgrade: ")) {
            const upgradeName = entry.label.replace("Upgrade: ", "");
            purchaseData = {
              userId: uid,
              userEmail: userData.email || userData.name || "Unknown",
              itemType: 'upgrade',
              itemId: upgradeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              itemName: upgradeName,
              cost: Math.abs(entry.delta),
              currency: 'coins',
              type: 'spend',
              timestamp: entry.ts || Date.now()
            };
          }
          
          if (purchaseData) {
            await setDoc(docRef, purchaseData);
            migratedCount++;
          }
        }
      }
    }
    return migratedCount;
  } catch (e) {
    console.error('migrateExistingPurchases failed', e);
    return 0;
  }
}

export async function getAllRooms(): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'rooms'));
    return snap.docs.map(d => ({ code: d.id, ...d.data() }));
  } catch (e) {
    console.error('getAllRooms failed', e);
    return [];
  }
}

export async function getFeedbacks(): Promise<any[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'feedback'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('getFeedbacks failed', e);
    return [];
  }
}
