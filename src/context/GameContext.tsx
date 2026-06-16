"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GAME_DATA } from '../data/game-data';
import { auth, isFirebaseEnabled } from '@/firebase/config';
import { getUserProfile, setUserProfile, updateUserProfile } from '@/firebase/firestore';

export interface AccountHistoryItem {
  label: string;
  delta: number;
  ts: number;
}

export interface Account {
  uid?: string;
  name: string;
  email: string;
  color: string;
  guest: boolean;
  credits: number;
  packs: string[];
  upgrades: string[];
  history: AccountHistoryItem[];
  wins: number;
  games: number;
  createdAt: number;
  admin?: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
  isYou?: boolean;
  isBot?: boolean;
  isConnected?: boolean;
  left?: boolean;
}

export interface HistoryEntry {
  round: number;
  pid: string;
  name: string;
  answer: string;
  prompt: string;
}

export interface GameSettings {
  name: string;
  maxPlayers: number;
  scoreLimit: number;
  timer: number;
  packs: string[];
  family: boolean;
  custom: boolean;
}

export interface EndData {
  code: string;
  players: Player[];
  history: HistoryEntry[];
  earned: number;
}

export interface Pack {
  id: string;
  name: string;
  cards: number;
  free?: boolean;
  price?: number;
  prompts?: string[];
  answers?: string[];
  familyFriendly?: boolean;
}

export interface GameContextType {
  account: Account | null;
  setAccount: React.Dispatch<React.SetStateAction<Account | null>>;
  mode: string;
  setMode: React.Dispatch<React.SetStateAction<string>>;
  settings: GameSettings;
  setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
  roster: Player[] | null;
  setRoster: React.Dispatch<React.SetStateAction<Player[] | null>>;
  endData: EndData | null;
  setEndData: React.Dispatch<React.SetStateAction<EndData | null>>;
  gameKey: number;
  setGameKey: React.Dispatch<React.SetStateAction<number>>;
  demo: string | null;
  setDemo: React.Dispatch<React.SetStateAction<string | null>>;
  isHydrated: boolean;
  packs: Pack[];
  getCardsForPacks: (selectedPackIds: string[], family?: boolean) => { prompts: string[]; answers: string[] };
  spend: (cost: number, label: string, apply: (a: Account) => Account) => void;
  buyPack: (p: { id: string; name: string; price: number }) => void;
  buyUpgrade: (u: { id: string; price: number; name: string }) => void;
  buyCredits: (b: { coins: number; tag: string }) => void;
  handleLogin: (info: { name: string; email: string }) => void;
  logout: () => void;
  startGame: (r: Player[], code?: string) => void;
  handleEnd: (players: Player[], history: HistoryEntry[], code?: string) => void;
  replay: (code?: string) => void;
}

export function freePackIds(packs: Pack[]): string[] {
  return packs.filter((p) => p.free || p.id === 'classic').map((p) => p.id);
}

export function maxPlayersFor(account: Account | null): number {
  if (account && account.upgrades.includes("mp20")) return 20;
  if (account && account.upgrades.includes("mp10")) return 10;
  return 5;
}

export function ownsPack(account: Account | null, p: Pack): boolean {
  return !!p.free || p.id === 'classic' || (account ? account.packs.includes(p.id) : false);
}

const AVATAR_COLORS = ["#FF5C39", "#7C5CFF", "#2BC4BE", "#FF4D8D", "#5CA9FF", "#FFC93C"];

function hashEmail(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const GameContext = createContext<GameContextType | null>(null);

const DEFAULT_SETTINGS: GameSettings = {
  name: "Alex", maxPlayers: 5, scoreLimit: 3, timer: 45,
  packs: ["classic"], family: false, custom: false
};

export function GameProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<string>("host");
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [roster, setRoster] = useState<Player[] | null>(null);
  const [endData, setEndData] = useState<EndData | null>(null);
  const [gameKey, setGameKey] = useState<number>(1);
  const [demo, setDemo] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [firestorePacks, setFirestorePacks] = useState<Pack[]>([]);
  // Track the Firebase UID separately so we can write Firestore without stale closures
  const firebaseUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseEnabled) return;
    let unsubscribe: () => void = () => {};
    
    async function loadFirestorePacks() {
      const { subscribePackages } = await import('@/firebase/firestore');
      unsubscribe = subscribePackages((pkgs) => {
        const mapped: Pack[] = pkgs.map((p: any) => ({
          id: p.id || p.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          name: p.name,
          cards: p.cards || ((p.prompts?.length || 0) + (p.answers?.length || 0)),
          free: !!p.free,
          price: p.price || 0,
          prompts: p.prompts || [],
          answers: p.answers || [],
          familyFriendly: p.familyFriendly === undefined ? true : !!p.familyFriendly
        }));
        setFirestorePacks(mapped);
      });
    }
    
    loadFirestorePacks();
    return () => unsubscribe();
  }, [isFirebaseEnabled]);

  const packs = React.useMemo(() => {
    const list = [...GAME_DATA.packs] as Pack[];
    
    firestorePacks.forEach((fp) => {
      const idx = list.findIndex((p) => p.id === fp.id);
      if (idx >= 0) {
        list[idx] = fp;
      } else {
        list.push(fp);
      }
    });
    return list;
  }, [firestorePacks]);

  const getCardsForPacks = useCallback((selectedPackIds: string[], family?: boolean) => {
    let promptsPool: string[] = [];
    let answersPool: string[] = [];

    packs.forEach((ip) => {
      if (selectedPackIds.includes(ip.id)) {
        if (family && ip.familyFriendly === false) return;
        if (ip.prompts) promptsPool = [...promptsPool, ...ip.prompts];
        if (ip.answers) answersPool = [...answersPool, ...ip.answers];
      }
    });

    promptsPool = Array.from(new Set(promptsPool));
    answersPool = Array.from(new Set(answersPool));

    if (promptsPool.length === 0) {
      promptsPool = ["Draw a card."];
    }
    if (answersPool.length === 0) {
      answersPool = ["A card."];
    }

    return { prompts: promptsPool, answers: answersPool };
  }, [packs]);

  // ── Hydrate from localStorage on mount (guest / offline fallback) ──────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cah-account");
      if (stored) {
        setAccount(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to parse pb-account", e);
    }
    setIsHydrated(true);
  }, []);

  // ── Persist account to localStorage (cache) ───────────────────────────────
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (account) {
        localStorage.setItem("cah-account", JSON.stringify(account));
      } else {
        localStorage.removeItem("cah-account");
      }
    } catch (e) {
      console.error("Failed to save pb-account", e);
    }
  }, [account, isHydrated]);

  // ── Firebase Auth state observer + Firestore profile sync ─────────────────
  useEffect(() => {
    if (!isFirebaseEnabled || !auth) return;
    let unsubscribe: () => void = () => {};

    import('firebase/auth').then(({ onAuthStateChanged }) => {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {
        if (firebaseUser) {
          const uid: string = firebaseUser.uid;
          const email: string = firebaseUser.email || "";
          const displayName: string = firebaseUser.displayName || "Google User";
          const isAdmin = email === "sidhanshumonga28@gmail.com";
          const avatarColor = hashEmail(email);

          firebaseUidRef.current = uid;

          // Try to load profile from Firestore
          const existingProfile = await getUserProfile(uid);

          if (existingProfile) {
            // Existing user — load from Firestore, refresh display name
            setAccount({
              ...existingProfile,
              uid,
              name: displayName,
              email,
              color: avatarColor,
              admin: isAdmin,
            });
            // Keep name in sync in Firestore if it changed
            await updateUserProfile(uid, { name: displayName, email, color: avatarColor, admin: isAdmin });
          } else {
            // New user — create Firestore profile with welcome bonus
            const newProfile: Account = {
              uid,
              name: displayName,
              email,
              color: avatarColor,
              guest: false,
              credits: 50,
              packs: ["classic"],
              upgrades: [],
              history: [{ label: "Welcome bonus", delta: 50, ts: Date.now() }],
              wins: 0,
              games: 0,
              createdAt: Date.now(),
              admin: isAdmin,
            };
            await setUserProfile(uid, newProfile);
            setAccount(newProfile);
          }
        } else {
          // Signed out
          firebaseUidRef.current = null;
          setAccount((current) => (current?.guest ? current : null));
        }
      });
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [isFirebaseEnabled]);

  // ── Helper to persist account updates to Firestore ────────────────────────
  const persistToFirestore = useCallback(async (partial: Partial<Account>) => {
    const uid = firebaseUidRef.current;
    if (uid && isFirebaseEnabled) {
      await updateUserProfile(uid, partial);
    }
  }, []);

  // ── Spend / buy helpers ───────────────────────────────────────────────────
  const spend = useCallback((cost: number, label: string, apply: (a: Account) => Account) => {
    setAccount((a) => {
      if (!a || a.credits < cost) return a;
      const b = apply({ ...a, credits: a.credits - cost });
      b.history = [{ label, delta: -cost, ts: Date.now() }, ...b.history];
      persistToFirestore({ credits: b.credits, packs: b.packs, upgrades: b.upgrades, history: b.history });
      return b;
    });
  }, [persistToFirestore]);

  const buyPack = useCallback((p: { id: string; name: string; price: number }) => {
    spend(p.price, "Pack: " + p.name, (a) => ({ ...a, packs: [...a.packs, p.id] }));
  }, [spend]);

  const buyUpgrade = useCallback((u: { id: string; price: number; name: string }) => {
    spend(u.price, "Upgrade: " + u.name, (a) => ({ ...a, upgrades: [...a.upgrades, u.id] }));
  }, [spend]);

  const buyCredits = useCallback((b: { coins: number; tag: string }) => {
    setAccount((a) => {
      if (!a) return a;
      const newHistory = [{ label: "Coin top-up (" + b.tag + ")", delta: b.coins, ts: Date.now() }, ...a.history];
      const updated = { ...a, credits: a.credits + b.coins, history: newHistory };
      persistToFirestore({ credits: updated.credits, history: newHistory });
      return updated;
    });
  }, [persistToFirestore]);

  // ── Sandbox login (no Firebase) ───────────────────────────────────────────
  const handleLogin = useCallback((info: { name: string; email: string }) => {
    const email = info.email.trim().toLowerCase();
    const isAdmin = email === "sidhanshumonga28@gmail.com";
    const avatarColor = hashEmail(email);

    setAccount((a) => {
      if (!a) {
        return {
          name: info.name,
          email,
          color: avatarColor,
          guest: false,
          credits: 50,
          packs: ["classic"],
          upgrades: [],
          history: [{ label: "Welcome bonus", delta: 50, ts: Date.now() }],
          wins: 0,
          games: 0,
          createdAt: Date.now(),
          admin: isAdmin
        };
      }
      return { ...a, name: info.name, email, color: avatarColor, admin: isAdmin };
    });
    router.push('/');
  }, [router]);

  const startGame = useCallback((r: Player[], code?: string) => {
    setRoster(r);
    setDemo(null);
    setGameKey((k) => k + 1);
    router.push(`/game/${code || 'ABCD'}`);
  }, [router]);

  const handleEnd = useCallback((players: Player[], history: HistoryEntry[], code?: string) => {
    if (account) {
      const you = players.find((p) => p.isYou);
      const top = Math.max.apply(null, players.map((p) => p.score));
      const won = you && you.score === top;
      setAccount((a) => {
        if (!a) return a;
        const updated = {
          ...a,
          games: a.games + 1,
          wins: a.wins + (won ? 1 : 0),
        };
        persistToFirestore({ games: updated.games, wins: updated.wins });
        return updated;
      });
    }
    setEndData({ code: code || '', players, history, earned: 0 });
    router.push('/end');
  }, [account, router, persistToFirestore]);

  const replay = useCallback((code?: string) => {
    setDemo(null);
    setEndData(null);
    setGameKey((k) => k + 1);
    if (code) {
      router.push(`/lobby/${code}`);
    } else {
      router.push('/');
    }
  }, [router]);

  const logout = useCallback(async () => {
    if (isFirebaseEnabled && auth) {
      try {
        const { signOut } = await import('firebase/auth');
        await signOut(auth);
      } catch (e) {
        console.error("Firebase signOut failed", e);
      }
    }
    firebaseUidRef.current = null;
    setAccount(null);
  }, []);

  return (
    <GameContext.Provider value={{
      account, setAccount,
      mode, setMode,
      settings, setSettings,
      roster, setRoster,
      endData, setEndData,
      gameKey, setGameKey,
      demo, setDemo,
      isHydrated,
      packs,
      getCardsForPacks,
      spend, buyPack, buyUpgrade, buyCredits, handleLogin,
      logout,
      startGame, handleEnd, replay
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGameContext must be used within a GameProvider");
  }
  return context;
}
