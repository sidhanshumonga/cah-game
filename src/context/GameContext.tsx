"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GAME_DATA } from '../data/game-data';
import { auth, isFirebaseEnabled } from '@/firebase/config';
import { getUserProfile, setUserProfile, updateUserProfile, subscribeUserProfile } from '@/firebase/firestore';

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
  isHost?: boolean;
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
  botsCount: number;
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
  isPacksLoaded: boolean;
  packs: Pack[];
  getCardsForPacks: (selectedPackIds: string[], family?: boolean) => { prompts: string[]; answers: string[] };
  spend: (cost: number, label: string, apply: (a: Account) => Account) => void;
  buyPack: (p: { id: string; name: string; price: number }) => void | Promise<void>;
  buyUpgrade: (u: { id: string; price: number; name: string }) => void | Promise<void>;
  buyCredits: (b: { coins: number; tag: string }) => void;
  handleLogin: (info: { name: string; email: string }) => void;
  updateProfile: (updates: { name: string; color: string }) => Promise<void>;
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

const ADJECTIVES = ["Silly", "Wobbly", "Giggle", "Sneaky", "Haunted", "Spooky", "Funky", "Rowdy", "Derpy", "Sassy", "Jolly", "Cheeky"];
const NOUNS = ["Raccoon", "Roomba", "Toaster", "Crouton", "Sloth", "Hippo", "Badger", "Puffin", "Goose", "Llama", "Potato", "Noodle"];

function generateRandomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}${noun}${num}`;
}

export function isIndianPack(p: { id: string; name: string }): boolean {
  const nameLower = p.name.toLowerCase();
  const idLower = p.id.toLowerCase();
  return (
    nameLower.includes("india") ||
    nameLower.includes("desi") ||
    nameLower.includes("bollywood") ||
    nameLower.includes("cricket") ||
    idLower.includes("india") ||
    idLower.includes("desi") ||
    idLower.includes("bollywood") ||
    idLower.includes("cricket")
  );
}

export function isUserIndian(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta')) {
      return true;
    }
    const langs = navigator.languages || [navigator.language];
    for (const lang of langs) {
      const l = lang.toLowerCase();
      if (
        l === 'hi' ||
        l.endsWith('-in') ||
        l.startsWith('hi-') ||
        l === 'mr' ||
        l === 'ta' ||
        l === 'te' ||
        l === 'gu' ||
        l === 'kn' ||
        l === 'ml' ||
        l === 'pa' ||
        l === 'bn'
      ) {
        return true;
      }
    }
  } catch (e) {
    console.error("Failed to detect location/timezone", e);
  }
  return false;
}

export interface RegionInfo {
  country: 'IN' | 'GB' | 'CN' | 'AE' | 'US';
  currency: 'inr' | 'gbp' | 'usd' | 'aed';
  symbol: string;
  bundles: Array<{ coins: number; tag: string; productId: string; best?: boolean }>;
}

export function getUserRegion(): RegionInfo {
  const defaultInfo: RegionInfo = {
    country: 'US',
    currency: 'usd',
    symbol: '$',
    bundles: [
      { coins: 500, tag: "$4.99", productId: "prod_UiU1bLVVTs3WEp" },
      { coins: 1200, tag: "$9.99", productId: "prod_UiU1NqbXoVoF78", best: true },
      { coins: 3000, tag: "$19.99", productId: "prod_UiU2mxisRKNBys" }
    ]
  };

  if (typeof window === 'undefined') return defaultInfo;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const langs = navigator.languages || [navigator.language];

    // 1. Check India
    const isIndiaTz = tz && (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta');
    const isIndiaLang = langs.some(lang => {
      const l = lang.toLowerCase();
      return l === 'hi' || l.endsWith('-in') || l.startsWith('hi-') || 
             ['mr', 'ta', 'te', 'gu', 'kn', 'ml', 'pa', 'bn'].some(code => l === code);
    });
    if (isIndiaTz || isIndiaLang) {
      return {
        country: 'IN',
        currency: 'inr',
        symbol: '₹',
        bundles: [
          { coins: 500, tag: "₹199", productId: "prod_UiU1bLVVTs3WEp" },
          { coins: 1200, tag: "₹399", productId: "prod_UiU1NqbXoVoF78", best: true },
          { coins: 3000, tag: "₹799", productId: "prod_UiU2mxisRKNBys" }
        ]
      };
    }

    // 2. Check UK
    const isUKTz = tz && (tz === 'Europe/London' || tz === 'Europe/Belfast' || tz === 'Europe/Guernsey' || tz === 'Europe/Jersey' || tz === 'Europe/Isle_of_Man');
    const isUKLang = langs.some(lang => lang.toLowerCase().endsWith('-gb'));
    if (isUKTz || isUKLang) {
      return {
        country: 'GB',
        currency: 'gbp',
        symbol: '£',
        bundles: [
          { coins: 500, tag: "£3.99", productId: "prod_UiU1bLVVTs3WEp" },
          { coins: 1200, tag: "£7.99", productId: "prod_UiU1NqbXoVoF78", best: true },
          { coins: 3000, tag: "£15.99", productId: "prod_UiU2mxisRKNBys" }
        ]
      };
    }

    // 3. Check UAE
    const isUAETz = tz && tz === 'Asia/Dubai';
    const isUAELang = langs.some(lang => lang.toLowerCase().endsWith('-ae'));
    if (isUAETz || isUAELang) {
      return {
        country: 'AE',
        currency: 'aed',
        symbol: 'AED ',
        bundles: [
          { coins: 500, tag: "AED 18.99", productId: "prod_UiU1bLVVTs3WEp" },
          { coins: 1200, tag: "AED 36.99", productId: "prod_UiU1NqbXoVoF78", best: true },
          { coins: 3000, tag: "AED 72.99", productId: "prod_UiU2mxisRKNBys" }
        ]
      };
    }

    // 4. Check China (uses defaultInfo but sets country = CN)
    const isChinaTz = tz && ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Harbin', 'Asia/Urumqi'].includes(tz);
    const isChinaLang = langs.some(lang => lang.toLowerCase().startsWith('zh'));
    if (isChinaTz || isChinaLang) {
      return {
        ...defaultInfo,
        country: 'CN'
      };
    }

  } catch (e) {
    console.error("Failed to detect location/timezone for region pricing", e);
  }

  return defaultInfo;
}

export function sortPacks(packs: Pack[], account: Account | null, isIndianUser: boolean): Pack[] {
  return [...packs].sort((a, b) => {
    // 1. Classic pack always first
    const aIsClassic = a.id === 'classic';
    const bIsClassic = b.id === 'classic';
    if (aIsClassic && !bIsClassic) return -1;
    if (!aIsClassic && bIsClassic) return 1;
    if (aIsClassic && bIsClassic) return 0;

    // Determine ownership
    const aOwned = ownsPack(account, a);
    const bOwned = ownsPack(account, b);

    // Grouping
    // Group 1: Owned Indian packs (only for Indian users)
    // Group 2: Other owned packs
    // Group 3: Unowned Indian packs (only for Indian users)
    // Group 4: Other unowned packs (and free Indian packs for non-Indian users)
    let aGroup = 0;
    if (isIndianUser) {
      if (aOwned) {
        aGroup = isIndianPack(a) ? 1 : 2;
      } else {
        aGroup = isIndianPack(a) ? 3 : 4;
      }
    } else {
      const aIsFreeIndian = !!a.free && isIndianPack(a);
      if (aOwned && !aIsFreeIndian) {
        aGroup = 2;
      } else {
        aGroup = 4;
      }
    }

    let bGroup = 0;
    if (isIndianUser) {
      if (bOwned) {
        bGroup = isIndianPack(b) ? 1 : 2;
      } else {
        bGroup = isIndianPack(b) ? 3 : 4;
      }
    } else {
      const bIsFreeIndian = !!b.free && isIndianPack(b);
      if (bOwned && !bIsFreeIndian) {
        bGroup = 2;
      } else {
        bGroup = 4;
      }
    }

    if (aGroup !== bGroup) {
      return aGroup - bGroup;
    }

    // Within the same group, sort alphabetically by name (case-insensitive)
    return a.name.localeCompare(b.name);
  });
}


const GameContext = createContext<GameContextType | null>(null);

const DEFAULT_SETTINGS: GameSettings = {
  name: "Alex", maxPlayers: 5, scoreLimit: 3, timer: 30,
  packs: ["classic"], family: false, custom: false, botsCount: 0
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
  const [isPacksLoaded, setIsPacksLoaded] = useState<boolean>(false);
  const [firestorePacks, setFirestorePacks] = useState<Pack[]>([]);
  // Track the Firebase UID separately so we can write Firestore without stale closures
  const firebaseUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseEnabled) {
      setIsPacksLoaded(true);
      return;
    }
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
        setIsPacksLoaded(true);
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
    let unsubscribeAuth: () => void = () => {};
    let unsubscribeProfile: (() => void) | null = null;

    import('firebase/auth').then(({ onAuthStateChanged }) => {
      unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser: any) => {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        if (firebaseUser) {
          const uid: string = firebaseUser.uid;
          const email: string = firebaseUser.email || "";
          const displayName: string = firebaseUser.displayName || "Google User";
          const isAdmin = email === "sidhanshumonga28@gmail.com";
          const avatarColor = hashEmail(email);

          firebaseUidRef.current = uid;

          // 1. One-time check and profile creation using getUserProfile (server-first lookup)
          try {
            const existingProfile = await getUserProfile(uid);
            if (!existingProfile) {
              console.log("[auth] No user profile document found for uid, creating new profile...");
              const randomName = generateRandomName();
              const newProfile: Account = {
                uid,
                name: randomName,
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
            }
          } catch (profileErr) {
            console.error("[auth] Error checking/creating profile document:", profileErr);
          }

          // 2. Subscribe to real-time updates for their Firestore profile (read-only listener)
          unsubscribeProfile = subscribeUserProfile(uid, (profile: any) => {
            if (profile) {
              setAccount({
                ...profile,
                uid,
                name: profile.name || displayName,
                email,
                color: profile.color || avatarColor,
                admin: isAdmin,
              });
            }
          });

          // Sync email/admin flags to Firestore once on sign in (non-blocking)
          updateUserProfile(uid, { email, admin: isAdmin }).catch(err => {
            console.error("Failed to sync auth details to Firestore profile", err);
          });

        } else {
          // Signed out
          firebaseUidRef.current = null;
          setAccount((current) => (current?.guest ? current : null));
        }
      });
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeProfile) (unsubscribeProfile as any)();
    };
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
    let userUid: string | null = null;
    let userEmail: string | null = null;
    let userName: string | null = null;

    setAccount((a) => {
      if (!a || a.credits < cost) return a;
      userUid = a.uid || null;
      userEmail = a.email || null;
      userName = a.name || null;

      const b = apply({ ...a, credits: a.credits - cost });
      b.history = [{ label, delta: -cost, ts: Date.now() }, ...b.history];
      persistToFirestore({ credits: b.credits, packs: b.packs, upgrades: b.upgrades, history: b.history });
      return b;
    });

    if (userUid) {
      const isPack = label.startsWith("Pack: ");
      const isUpgrade = label.startsWith("Upgrade: ");
      const name = label.replace(/^(Pack:|Upgrade:)\s*/, "");
      const itemType = isPack ? 'pack' : isUpgrade ? 'upgrade' : 'other';
      const itemId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // Log to Firebase Analytics
      import('@/firebase/config').then(({ logAnalyticsEvent }) => {
        logAnalyticsEvent('coin_spent', {
          itemType,
          itemId,
          itemName: name,
          cost
        });
      });

      import('@/firebase/firestore').then(({ logPurchase }) => {
        logPurchase({
          userId: userUid!,
          userEmail: userEmail || userName || 'unknown',
          itemType,
          itemId,
          itemName: name,
          cost: cost,
          currency: 'coins',
          type: 'spend',
          timestamp: Date.now()
        }).catch(e => console.error("Failed to log purchase:", e));
      });
    }
  }, [persistToFirestore]);

  const buyPack = useCallback(async (p: { id: string; name: string; price: number }) => {
    if (isFirebaseEnabled && auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        const res = await fetch('/api/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ itemId: p.id, itemType: 'pack' })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to complete purchase');
        }
      } catch (err: any) {
        console.error("Failed to buy pack securely:", err);
        alert(err.message || "Failed to purchase pack");
      }
    } else {
      spend(p.price, "Pack: " + p.name, (a) => ({ ...a, packs: [...a.packs, p.id] }));
    }
  }, [isFirebaseEnabled, spend]);

  const buyUpgrade = useCallback(async (u: { id: string; price: number; name: string }) => {
    if (isFirebaseEnabled && auth.currentUser) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        const res = await fetch('/api/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ itemId: u.id, itemType: 'upgrade' })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to complete purchase');
        }
      } catch (err: any) {
        console.error("Failed to buy upgrade securely:", err);
        alert(err.message || "Failed to purchase upgrade");
      }
    } else {
      spend(u.price, "Upgrade: " + u.name, (a) => ({ ...a, upgrades: [...a.upgrades, u.id] }));
    }
  }, [isFirebaseEnabled, spend]);

  const buyCredits = useCallback((b: { coins: number; tag: string }) => {
    setAccount((a) => {
      if (!a) return a;
      const newHistory = [{ label: "Coin top-up (" + b.tag + ")", delta: b.coins, ts: Date.now() }, ...a.history];
      const updated = { ...a, credits: a.credits + b.coins, history: newHistory };
      persistToFirestore({ credits: updated.credits, history: newHistory });
      return updated;
    });
  }, [persistToFirestore]);

  const updateProfile = useCallback(async (updates: { name: string; color: string }) => {
    setAccount((a) => {
      if (!a) return a;
      const updated = { ...a, ...updates };
      persistToFirestore(updates);
      return updated;
    });
    try {
      const stored = localStorage.getItem("cah-account");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem("cah-account", JSON.stringify({ ...parsed, ...updates }));
      }
    } catch (e) {
      console.error("Failed to save updated profile to local storage", e);
    }
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
      isPacksLoaded,
      packs,
      getCardsForPacks,
      spend, buyPack, buyUpgrade, buyCredits, handleLogin, updateProfile,
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
