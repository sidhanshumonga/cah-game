"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useGameContext, Player, HistoryEntry } from '@/context/GameContext';
import {
  TopBar,
  ScorePanel,
  PromptCard,
  Avatar,
  AnswerCard,
  FlipCard,
  TimerBar,
  Btn,
  ConfettiBurst,
  ReactionBar,
  ReactionLayer,
  CrownIcon,
  spawnReaction,
  SideScores
} from '@/components/components';
import { GAME_DATA } from '@/data/game-data';
import { buildSeededDeck, getPromptForRound, seededShuffle } from '@/utils/deck';
import { isFirebaseEnabled } from '@/firebase/config';
import { Bot, X } from 'lucide-react';
import FeedbackModal from '@/components/FeedbackModal';

function shuffleArr<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = x[i]; x[i] = x[j]; x[j] = tmp;
  }
  return x;
}

function makeDraw<T>(arr: T[]): () => T {
  let pool = shuffleArr(arr);
  return () => {
    if (!pool.length) pool = shuffleArr(arr);
    return pool.pop()!;
  };
}

// Seeded deck functions imported from '@/utils/deck'

function makeDrawSeeded<T>(arr: T[], seed: string, playerIndex: number, totalSlots: number = 31): () => T {
  const playerPool = arr.filter((_, idx) => idx % totalSlots === playerIndex);
  
  let pool = [...playerPool];
  let cycle = 1;
  
  return () => {
    if (!pool.length) {
      cycle++;
      const nextShuffled = seededShuffle(arr, `${seed}-cycle-${cycle}`);
      const nextPool = nextShuffled.filter((_, idx) => idx % totalSlots === playerIndex);
      pool = [...nextPool];
    }
    return pool.pop() || arr[0];
  };
}

// ─────────────────────────────────────────────────────────────────
// MULTIPLAYER GAME (Firestore-driven)
// ─────────────────────────────────────────────────────────────────
function MultiplayerGame({ code }: { code: string }) {
  const router = useRouter();
  const { account, settings, setSettings, handleEnd, isHydrated, getCardsForPacks, packs } = useGameContext();

  const myUid = account?.uid || account?.email || "guest";
  const myName = account?.name || "Player";

  // Firestore game state
  const [gameState, setGameState] = useState<any>(null);
  const phase = gameState?.phase || "pick";
  const [roomPlayers, setRoomPlayers] = useState<any[]>([]);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [hostUid, setHostUid] = useState<string | null>(null);

  const isHost = useMemo(() => {
    if (hostUid) return myUid === hostUid;
    return roomPlayers.find(p => p.uid === myUid)?.isHost || false;
  }, [roomPlayers, myUid, hostUid]);

  // Local per-player private hand (not in Firestore)
  const drawA = useRef<() => string>(null!);
  const drawCardRef = useRef<(seen: string[]) => string>(null!);
  const [deckReady, setDeckReady] = useState(false);

  const playerIndex = useMemo(() => {
    if (gameState && Array.isArray(gameState.originalPlayers)) {
      return gameState.originalPlayers.indexOf(myUid);
    }
    if (!roomPlayers.length) return -1;
    const sorted = [...roomPlayers].sort((a, b) => a.uid.localeCompare(b.uid));
    return sorted.findIndex(p => p.uid === myUid);
  }, [gameState?.originalPlayers, roomPlayers, myUid]);

  const totalSlots = useMemo(() => {
    if (gameState && Array.isArray(gameState.originalPlayers)) {
      return Math.max(1, gameState.originalPlayers.length);
    }
    return 12; // Fallback to safe pool-division size
  }, [gameState?.originalPlayers]);

  const packsKey = settings.packs.join(",");

  useEffect(() => {
    if (packs && packs.length > 0 && playerIndex !== -1) {
      const deck = buildSeededDeck(settings.packs, packs, settings.family, code);
      drawA.current = makeDrawSeeded(deck.answers, code, playerIndex, totalSlots);
      
      drawCardRef.current = (seen: string[]) => {
        let card = drawA.current();
        let attempts = 0;
        while (seen.includes(card) && attempts < 100) {
          card = drawA.current();
          attempts++;
        }
        return card;
      };
      
      setDeckReady(true);
    }
  }, [packsKey, packs, playerIndex, totalSlots, code, settings.packs, settings.family]);

  const [hand, setHand] = useState<string[]>([]);
  const [myPick, setMyPick] = useState<string | null>(null);
  const [mySubmitted, setMySubmitted] = useState(false);
  const [scoresOpen, setScoresOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapPicks, setSwapPicks] = useState<number[]>([]);
  const [swapsUsed, setSwapsUsed] = useState(0);
  const lastRoundRef = useRef<number>(0);

  const hasSwapPlus = !!(account && account.upgrades.includes("swapPlus"));
  const maxSwap = hasSwapPlus ? 5 : 3;
  const every = hasSwapPlus ? 2 : 3;

  // Chat states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [roomEndStatus, setRoomEndStatus] = useState<'none' | 'ended' | 'completed'>('none');
  const [roomExists, setRoomExists] = useState<boolean | null>(null);
  const playersRef = useRef<Player[]>([]);
  const hasTransitionedRef = useRef(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showAbortFeedbackModal, setShowAbortFeedbackModal] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const lastMsgCountRef = useRef(0);

  // Hand horizontal scroll arrow states
  const handRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkHandScroll = useCallback(() => {
    const el = handRef.current;
    if (!el) return;
    setShowLeftArrow(el.scrollLeft > 10);
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = handRef.current;
    if (!el) return;
    checkHandScroll();
    el.addEventListener('scroll', checkHandScroll);
    window.addEventListener('resize', checkHandScroll);
    return () => {
      el.removeEventListener('scroll', checkHandScroll);
      window.removeEventListener('resize', checkHandScroll);
    };
  }, [hand, checkHandScroll]);

  // Subscribe to room + game state + room players + chat + reactions
  useEffect(() => {
    if (!isHydrated) return;
    const subs: (() => void)[] = [];

    async function subscribe() {
      const { subscribeGameState, subscribeRoomPlayers, subscribeRoomChat, subscribeReactions, subscribeRoom } = await import('@/firebase/firestore');

      subs.push(subscribeRoom(code, (roomData) => {
        if (!roomData || roomData.status === 'closed') {
          setRoomExists(false);
          setRoomLoaded(true);
          router.push('/');
          return;
        }
        setRoomExists(true);
        if (roomData.hostUid) {
          setHostUid(roomData.hostUid);
        }
        if (roomData.settings) {
          setSettings(roomData.settings);
        }
        setRoomLoaded(true);
        if (roomData.status === 'lobby') {
          router.replace(`/lobby/${code}`);
        } else if (roomData.status === 'ended') {
          setRoomEndStatus('ended');
        } else if (roomData.status === 'completed') {
          if (!hasTransitionedRef.current) {
            if (playersRef.current && playersRef.current.length >= 2) {
              hasTransitionedRef.current = true;
              handleEnd(playersRef.current, [], code);
            } else {
              setRoomEndStatus('completed');
            }
          }
        }
      }));

      subs.push(subscribeGameState(code, (state) => {
        setGameState(state);
      }));

      subs.push(subscribeRoomPlayers(code, (players) => {
        setRoomPlayers(players);
      }));

      subs.push(subscribeRoomChat(code, (messages) => {
        setChatMessages(messages.map((m: any) => ({
          id: m.id,
          uid: m.uid,
          name: m.name,
          color: m.color,
          text: m.text,
        })));
      }));

      subs.push(subscribeReactions(code, (react) => {
        spawnReaction(react.emoji, undefined, react.name);
      }));
    }

    subscribe();
    return () => subs.forEach(u => u());
  }, [code, isHydrated, router]);

  // Prevent non-member players from entering the game page
  useEffect(() => {
    if (!isHydrated || !roomLoaded || !roomExists || !gameState) return;
    if (gameState.originalPlayers) {
      const isMember = gameState.originalPlayers.includes(myUid);
      if (!isMember) {
        router.replace('/');
      }
    }
  }, [isHydrated, roomLoaded, roomExists, gameState, myUid, router]);

  // Auto-kick disconnected non-host players after 30 seconds (host only)
  useEffect(() => {
    if (!isHost || !roomPlayers.length) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const { kickPlayer } = await import('@/firebase/firestore');
      
      for (const player of roomPlayers) {
        if (!player.isHost && player.isConnected === false && player.disconnectedAt) {
          let discTime = 0;
          const discAt = player.disconnectedAt;
          if (typeof discAt.toMillis === 'function') {
            discTime = discAt.toMillis();
          } else if (discAt.seconds) {
            discTime = discAt.seconds * 1000;
          } else if (typeof discAt === 'number') {
            discTime = discAt;
          } else if (discAt instanceof Date) {
            discTime = discAt.getTime();
          } else {
            discTime = new Date(discAt).getTime();
          }

          if (discTime && (now - discTime > 30000)) {
            console.log(`[game] Auto-kicking player ${player.name} (${player.uid}) due to disconnection for 30s.`);
            kickPlayer(code, player.uid).catch(e => console.error("Failed to auto-kick player:", e));
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isHost, roomPlayers, code]);

  // Auto-rejoin when disconnected and removed from roomPlayers (e.g. kicked)
  useEffect(() => {
    if (!isHydrated || !gameState || !roomLoaded || !account) return;
    
    // Check if I am one of the original players
    const isOriginal = gameState.originalPlayers && gameState.originalPlayers.includes(myUid);
    if (!isOriginal) return;

    // Check if I am currently in the room players list
    const inRoom = roomPlayers.some(p => p.uid === myUid);
    if (inRoom) return;

    // We are not in the room players list but we are an original player - let's rejoin!
    async function performRejoin() {
      console.log(`[game] Player ${myUid} is an original player but not in roomPlayers. Rejoining...`);
      const { joinRoom } = await import('@/firebase/firestore');
      
      // Determine score from gameState.scores[myUid]
      const score = (gameState.scores && typeof gameState.scores[myUid] === 'number')
        ? gameState.scores[myUid]
        : 0;

      // Determine isHost status
      const myIsHost = hostUid ? (myUid === hostUid) : false;

      try {
        await joinRoom(code, {
          uid: myUid,
          name: account.name,
          color: account.color,
          isHost: myIsHost,
        }, score);
        console.log(`[game] Successfully rejoined room ${code} with score ${score}`);
      } catch (err) {
        console.error(`[game] Failed to rejoin room ${code}:`, err);
      }
    }

    performRejoin();
  }, [isHydrated, gameState, roomPlayers, roomLoaded, account, myUid, hostUid, code]);

  // Sync unread messages count
  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
      lastMsgCountRef.current = chatMessages.length;
    } else {
      const diff = chatMessages.length - lastMsgCountRef.current;
      setUnreadCount(diff > 0 ? diff : 0);
    }
  }, [chatMessages, chatOpen]);

  // Auto scroll chat
  useEffect(() => {
    if (chatOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatOpen]);

  const sendGameChat = async () => {
    if (!chatDraft.trim() || !account) return;
    const { sendChatMessage } = await import('@/firebase/firestore');
    await sendChatMessage(code, account.uid || account.email, account.name, account.color, chatDraft.trim());
    setChatDraft("");
  };

  const handleSendReaction = useCallback(async (emoji: string) => {
    const { sendReaction } = await import('@/firebase/firestore');
    await sendReaction(code, emoji, myName);
  }, [code, myName]);

  // Deal hand at start of each new round or restore from localStorage on page reload
  useEffect(() => {
    if (!gameState || playerIndex === -1 || !deckReady) return;
    const round = gameState.round || 1;
    if (round !== lastRoundRef.current) {
      lastRoundRef.current = round;
      
      const storageKey = `cah-game-session-${code}-${myUid}`;
      let loadedHand: string[] | null = null;
      let loadedSwaps = 0;
      
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.hand)) {
            let seen = Array.isArray(parsed.seenCards) ? parsed.seenCards : [...parsed.hand];
            
            if (parsed.round === round) {
              loadedHand = parsed.hand;
              loadedSwaps = parsed.swapsUsed || 0;
            } else if (round === 1) {
              // This is a new game / replay! Clear hand and seen cards.
              loadedHand = null;
            } else {
              // Transitioning from a previous round - carry over the hand and remove only the submitted card
              let nextHand = [...parsed.hand];
              if (parsed.submittedCard) {
                const idx = nextHand.indexOf(parsed.submittedCard);
                if (idx !== -1) {
                  nextHand.splice(idx, 1);
                }
              }
              while (nextHand.length < 7) {
                const newCard = drawCardRef.current?.(seen) || "";
                nextHand.push(newCard);
                if (newCard && !seen.includes(newCard)) {
                  seen.push(newCard);
                }
              }
              loadedHand = nextHand;
              loadedSwaps = parsed.swapsUsed || 0;
              
              // Save the transitioned hand
              localStorage.setItem(storageKey, JSON.stringify({
                round,
                hand: nextHand,
                swapsUsed: loadedSwaps,
                submittedCard: null,
                seenCards: seen
              }));
            }
          }
        }
      } catch (e) {
        console.error("Failed to load game session", e);
      }
      
      if (loadedHand) {
        setHand(loadedHand);
        setSwapsUsed(loadedSwaps);
      } else {
        let seen: string[] = [];
        const newHand: string[] = [];
        for (let i = 0; i < 7; i++) {
          const card = drawCardRef.current?.(seen) || "";
          newHand.push(card);
          if (card && !seen.includes(card)) {
            seen.push(card);
          }
        }
        setHand(newHand);
        setSwapsUsed(0);
        try {
          localStorage.setItem(storageKey, JSON.stringify({ round, hand: newHand, swapsUsed: 0, submittedCard: null, seenCards: seen }));
        } catch (e) {
          console.error("Failed to save game session", e);
        }
      }
      
      setMyPick(null);
      setMySubmitted(false);
      setFlipped(false);
      setSwapMode(false);
      setSwapPicks([]);
    }
  }, [gameState?.round, code, myUid, playerIndex, deckReady]);

  // Sync submission state from Firestore gameState on reload / update
  useEffect(() => {
    if (!gameState || !myUid) return;
    const subs = gameState.submissions || [];
    const mySub = subs.find((s: any) => s.uid === myUid);
    if (mySub) {
      setMySubmitted(true);
      setMyPick(mySub.text);
    }
  }, [gameState?.submissions, myUid]);

  // Flip cards after judging phase begins
  useEffect(() => {
    if (gameState?.phase !== 'judging') return;
    const t = setTimeout(() => setFlipped(true), 120);
    return () => clearTimeout(t);
  }, [gameState?.phase]);



  const judgeUid = gameState?.judgeUid;
  const youAreJudge = judgeUid === myUid;
  const subs = gameState?.submissions || [];
  const nonJudgePlayers = roomPlayers.filter(p => p.uid !== judgeUid);
  const needed = nonJudgePlayers.length;

  const handleSubmitCard = useCallback(async (text: string) => {
    if (!text) return;
    setMySubmitted(true);
    setMyPick(text);
    setSwapMode(false);
    setSwapPicks([]);
    
    // Save submitted card to localStorage session
    try {
      const storageKey = `cah-game-session-${code}-${myUid}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.submittedCard = text;
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      }
    } catch (e) {
      console.error("Failed to save submitted card on submit", e);
    }

    const { submitCard } = await import('@/firebase/firestore');
    await submitCard(code, myUid, myName, text);

    const { logAnalyticsEvent } = await import('@/firebase/config');
    logAnalyticsEvent('card_play', {
      code,
      roundNum: gameState?.round || 1,
      isJudge: youAreJudge
    });
  }, [code, myUid, myName, gameState?.round, youAreJudge]);

  // Timer countdown
  const [timeLeft, setTimeLeft] = useState(settings.timer);
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase === 'pick' || gameState.phase === 'judging') {
      setTimeLeft(settings.timer);
    }
  }, [gameState?.round, gameState?.phase, settings.timer]);

  useEffect(() => {
    if (!gameState) return;

    if (gameState.phase === 'pick') {
      if (youAreJudge || mySubmitted) return;
      if (timeLeft <= 0) {
        const card = myPick || hand[Math.floor(Math.random() * hand.length)];
        if (card) handleSubmitCard(card);
        return;
      }
    } else if (gameState.phase === 'judging') {
      if (timeLeft <= 0) {
        if (isHost) {
          import('@/firebase/firestore').then(({ updateGameState }) => {
            updateGameState(code, {
              phase: 'reveal',
              winnerUid: 'none',
            }).catch(() => {});
          });
        }
        return;
      }
    } else {
      return;
    }

    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [gameState?.phase, timeLeft, youAreJudge, mySubmitted, isHost, myPick, hand, code, handleSubmitCard]);

  useEffect(() => {
    if (!isHost || gameState?.phase !== 'pick' || subs.length < needed || needed === 0) return;
    const t = setTimeout(async () => {
      const { updateGameState } = await import('@/firebase/firestore');
      await updateGameState(code, {
        phase: 'judging',
        submissions: shuffleArr(subs),
      });
    }, 800);
    return () => clearTimeout(t);
  }, [isHost, subs.length, needed, gameState?.phase, code]);

  // Derive player list with scores from gameState
  const players: Player[] = useMemo(() => {
    return roomPlayers.map(p => ({
      id: p.uid,
      name: p.name,
      color: p.color,
      score: gameState?.scores?.[p.uid] || 0,
      isYou: p.uid === myUid,
      isBot: !!p.isBot,
      isConnected: p.isConnected !== false, // Default to true
      left: !!p.left,
      isHost: !!p.isHost,
    }));
  }, [roomPlayers, myUid, gameState?.scores]);

  // Keep playersRef updated
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Load full deck answers for bot selections
  const deckAnswers = useMemo(() => {
    if (!packs || packs.length === 0) return [];
    const deck = buildSeededDeck(settings.packs, packs, settings.family, code);
    return deck.answers;
  }, [settings.packs, packs, settings.family, code]);

  const judge = players.find(p => p.id === judgeUid) || { id: '', name: '', color: '', score: 0 };
  const you = players.find(p => p.isYou) || { id: '', name: '', color: '', score: 0 };
  const winner = players.find(p => p.id === gameState?.winnerUid);
  const winnerSub = subs.find((s: any) => s.uid === gameState?.winnerUid);
  const submittedUids = subs.map((s: any) => s.uid);
  const mid = (hand.length - 1) / 2;

  // Host-coordinated automated bot turns
  useEffect(() => {
    if (!isHost || !gameState || gameState.phase === 'reveal') return;

    // 1. Pick Phase: Bots submit cards automatically
    if (gameState.phase === 'pick') {
      const activeBots = players.filter(p => p.isBot && p.id !== judge.id);
      if (activeBots.length === 0) return;

      const submittedUids = (gameState.submissions || []).map((s: any) => s.uid);
      const pendingBots = activeBots.filter(b => !submittedUids.includes(b.id));

      if (pendingBots.length === 0) return;

      const timers: NodeJS.Timeout[] = [];
      
      pendingBots.forEach((bot) => {
        const delay = 3000 + Math.random() * 4000; // 3-7s delay
        const t = setTimeout(async () => {
          const { submitCard } = await import('@/firebase/firestore');
          if (deckAnswers.length === 0) return;
          
          const currentSubsText = (gameState.submissions || []).map((s: any) => s.text);
          let randomCard = deckAnswers[Math.floor(Math.random() * deckAnswers.length)];
          let attempts = 0;
          while (currentSubsText.includes(randomCard) && attempts < 50) {
            randomCard = deckAnswers[Math.floor(Math.random() * deckAnswers.length)];
            attempts++;
          }
          
          await submitCard(code, bot.id, bot.name, randomCard);
        }, delay);
        
        timers.push(t);
      });

      return () => {
        timers.forEach(clearTimeout);
      };
    }

    // 2. Judging Phase: If judge is a bot, pick a winner automatically
    if (gameState.phase === 'judging') {
      const judgeIsBot = judge.isBot;
      if (!judgeIsBot) return;

      const submissions = gameState.submissions || [];
      if (submissions.length === 0) return;

      const delay = 6000 + Math.random() * 4000; // 6-10s delay
      const t = setTimeout(async () => {
        const { updateGameState } = await import('@/firebase/firestore');
        
        const winnerSub = submissions[Math.floor(Math.random() * submissions.length)];
        const newScores = { ...(gameState?.scores || {}) };
        newScores[winnerSub.uid] = (newScores[winnerSub.uid] || 0) + 1;

        await updateGameState(code, {
          phase: 'reveal',
          winnerUid: winnerSub.uid,
          scores: newScores,
        });
      }, delay);

      return () => clearTimeout(t);
    }
  }, [isHost, gameState?.phase, gameState?.submissions, gameState?.scores, players, judge, deckAnswers, code]);

  // ── Connection state tracking (multiplayer game) ─────────────────────────
  useEffect(() => {
    import('@/firebase/firestore').then(({ updatePlayerConnection }) => {
      updatePlayerConnection(code, myUid, true).catch(() => {});
    });

    const handleDisconnect = () => {
      import('@/firebase/firestore').then(({ updatePlayerConnection }) => {
        updatePlayerConnection(code, myUid, false).catch(() => {});
      });
    };

    window.addEventListener('beforeunload', handleDisconnect);
    window.addEventListener('pagehide', handleDisconnect);

    return () => {
      window.removeEventListener('beforeunload', handleDisconnect);
      window.removeEventListener('pagehide', handleDisconnect);
      handleDisconnect();
    };
  }, [code, myUid]);



  const maxScore = players.length > 0 ? Math.max(...players.map(p => p.score)) : 0;
  const gameOver = maxScore >= settings.scoreLimit;


  const handleCrown = useCallback(async (pickedUid: string) => {
    if (judgeUid !== myUid) return;
    const { updateGameState } = await import('@/firebase/firestore');
    const newScores = { ...(gameState?.scores || {}) };
    newScores[pickedUid] = (newScores[pickedUid] || 0) + 1;

    await updateGameState(code, {
      phase: 'reveal',
      winnerUid: pickedUid,
      scores: newScores,
    });
  }, [judgeUid, myUid, gameState?.scores, code]);

  const handleNext = useCallback(async () => {
    if (gameOver) {
      hasTransitionedRef.current = true;
      // Navigate to end screen
      const histEntries: HistoryEntry[] = [];
      handleEnd(players, histEntries, code);
      const { updateRoom } = await import('@/firebase/firestore');
      await updateRoom(code, { status: 'completed' });
    } else if (isHost && gameState) {
      const { updateGameState } = await import('@/firebase/firestore');
      const activeUids = roomPlayers.map((p: any) => p.uid);
      const judgeOrder: string[] = (gameState.judgeOrder || activeUids).filter((uid: string) => activeUids.includes(uid));
      if (judgeOrder.length === 0) return;
      const nextRound = (gameState.round || 1) + 1;
      const nextJudgeIdx = (nextRound - 1) % judgeOrder.length;
      const nextJudgeUid = judgeOrder[nextJudgeIdx];
      
      const deck = buildSeededDeck(settings.packs, packs, settings.family, code);
      const prompt = getPromptForRound(deck.prompts, code, nextRound);

      await updateGameState(code, {
        round: nextRound,
        prompt,
        phase: 'pick',
        judgeUid: nextJudgeUid,
        judgeOrder,
        submissions: [],
        winnerUid: null,
      });
    }
  }, [gameOver, isHost, gameState, roomPlayers, code, players, handleEnd, settings.packs, settings.family, packs]);

  function toggleSwapPick(i: number) {
    setSwapPicks((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < maxSwap ? [...s, i] : s));
  }

  function doSwap() {
    if (!swapPicks.length) return;
    
    const storageKey = `cah-game-session-${code}-${myUid}`;
    const round = gameState?.round || 1;
    let seen: string[] = [];
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.seenCards)) {
          seen = parsed.seenCards;
        }
      }
    } catch (e) {
      console.error("Failed to load seenCards on swap", e);
    }
    
    if (seen.length === 0) {
      seen = [...hand];
    }
    
    const newHand = hand.map((c, i) => {
      if (swapPicks.includes(i)) {
        const newCard = drawCardRef.current?.(seen) || "";
        if (newCard && !seen.includes(newCard)) {
          seen.push(newCard);
        }
        return newCard;
      }
      return c;
    });
    
    const newSwaps = swapsUsed + 1;
    setHand(newHand);
    setSwapsUsed(newSwaps);
    setSwapMode(false);
    setSwapPicks([]);
    
    // Persist updated hand/swaps to localStorage
    try {
      localStorage.setItem(storageKey, JSON.stringify({ 
        round, 
        hand: newHand, 
        swapsUsed: newSwaps, 
        submittedCard: null,
        seenCards: seen 
      }));
    } catch (e) {
      console.error("Failed to save game session on swap", e);
    }
  }

  const swapCredits = Math.floor(((gameState?.round || 1) - 1) / every) - swapsUsed;
  const canSwap = swapCredits > 0;
  const nextSwapRound = every * (swapsUsed + 1) + 1;

  const handleLeaveGame = useCallback(async () => {
    const { leaveRoom } = await import('@/firebase/firestore');
    await leaveRoom(code, myUid, true); // softLeave = true
    router.replace('/');
  }, [code, myUid, router]);

  const handleEndGame = useCallback(async () => {
    if (!isHost) return;
    const { updateRoom } = await import('@/firebase/firestore');
    await updateRoom(code, { status: 'ended' });
    setShowEndConfirm(false);
    setShowAbortFeedbackModal(true);
  }, [code, isHost]);

  if (roomExists === false) {
    return (
      <div className="screen center-screen" data-screen-label="Game Not Found Screen">
        <div className="panel" style={{ maxWidth: '440px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px', color: '#ff4d4f' }}>Game Not Found</h2>
          <p className="muted" style={{ margin: '0 0 24px', fontSize: '15px', lineHeight: 1.4 }}>This game session or room does not exist.</p>
          <Btn big={true} onClick={() => router.push('/')}>Back to Homepage</Btn>
        </div>
      </div>
    );
  }

  if (roomEndStatus !== 'none') {
    const isCompleted = roomEndStatus === 'completed';
    return (
      <div className="screen center-screen" data-screen-label="Game Ended Screen">
        <div className="panel" style={{ maxWidth: '440px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px', color: isCompleted ? '#2bc4be' : '#ff4d4f' }}>
            {isCompleted ? "Game Completed" : "Game Ended"}
          </h2>
          <p className="muted" style={{ margin: '0 0 24px', fontSize: '15px', lineHeight: 1.4 }}>
            {isCompleted 
              ? "This game session has finished normally." 
              : "The host has ended the game session or closed the room."}
          </p>
          <Btn big={true} onClick={() => router.push('/')}>Back to Homepage</Btn>
        </div>
      </div>
    );
  }

  if (!isHydrated || !roomLoaded || !gameState || players.length === 0) {
    return (
      <div className="screen center-screen">
        <div className="waiting-text">Entering room<span className="dots"><i>.</i><i>.</i><i>.</i></span></div>
      </div>
    );
  }

  const roundNum = gameState.round || 1;
  const prompt = gameState.prompt || "";

  return (
    <div className="screen game" data-screen-label={"Game — " + phase}>
      <TopBar
        code={code}
        round={roundNum}
        players={players}
        judge={judge}
        you={you}
        limit={settings.scoreLimit}
        onScores={() => setScoresOpen(true)}
        onChatToggle={() => setChatOpen(!chatOpen)}
        unreadCount={unreadCount}
        isHost={isHost}
        onLeave={() => setShowLeaveConfirm(true)}
        onEndGame={() => setShowEndConfirm(true)}
      />
      <ScorePanel open={scoresOpen} onClose={() => setScoresOpen(false)} players={players} limit={settings.scoreLimit} />
      
      <div className="game-layout-container">
        {/* Left desktop leaderboard sidebar */}
        <aside className="game-sidebar-left">
          <SideScores players={players} judgeId={judgeUid} limit={settings.scoreLimit} />
        </aside>

        {/* Center content column */}
        <div className="game-center-content">
          {/* Mobile scoreboard, visible only on small screens (< 1180px) */}
          <div className="game-mobile-scores">
            <SideScores players={players} judgeId={judgeUid} limit={settings.scoreLimit} />
          </div>

          {/* PICK — not judge */}
          {phase === "pick" && !youAreJudge ? (
            <main className="game-main">
              {!mySubmitted ? <TimerBar seconds={timeLeft} total={settings.timer} /> : null}
              <div className="stage">
                <PromptCard text={prompt} className="stage-prompt" />
                <div className="status-row">
                  {players.filter(p => p.id !== judge.id).map((p) => {
                    const isDisconnected = p.isConnected === false;
                    return (
                      <div key={p.id} style={{ position: 'relative', opacity: isDisconnected ? 0.4 : 1 }} title={isDisconnected ? `${p.name} (Disconnected)` : undefined}>
                        <Avatar player={p} size={34} done={!isDisconnected && submittedUids.includes(p.id)} dim={!isDisconnected && !submittedUids.includes(p.id)} />
                        {isDisconnected && (
                          <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#ff4d4f', width: 8, height: 8, borderRadius: '50%', border: '2px solid #141414' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {!mySubmitted ? (
                <React.Fragment>
                  <div className="hand-toolbar">
                    <p className="hand-hint">
                      {swapMode ? `Select up to ${maxSwap} cards to replace (${swapPicks.length} picked)` : myPick ? "Locked and loaded?" : "Pick your funniest card"}
                    </p>
                    {!swapMode ? (
                      <button className={"swapbtn" + (canSwap ? "" : " swapbtn-off")} disabled={!canSwap} onClick={() => { setSwapMode(true); setMyPick(null); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"></path><path d="M21 3v5h-5"></path></svg>
                        {canSwap ? "Swap cards" + (swapCredits > 1 ? ` (${swapCredits})` : "") : roundNum <= every ? `Swaps unlock after round ${every}` : `Next swap in ${nextSwapRound - roundNum} round${nextSwapRound - roundNum > 1 ? "s" : ""}`}
                      </button>
                    ) : null}
                  </div>
                   <div className="mobile-hand-wrapper">
                    {showLeftArrow && (
                      <button 
                        type="button" 
                        className="hand-scroll-arrow left" 
                        onClick={() => handRef.current?.scrollBy({ left: -140, behavior: 'smooth' })}
                        aria-label="Scroll left"
                      >
                        ‹
                      </button>
                    )}
                    <div className="hand" ref={handRef}>
                      {hand.map((c, i) => (
                        <div key={c + i} className="hand-slot" style={{ "--rot": (i - mid) * 4 + "deg", "--ty": Math.abs(i - mid) * 9 + "px", "--dl": i * 70 + "ms" } as React.CSSProperties}>
                          <AnswerCard text={c} selected={!swapMode && myPick === c} className={swapMode && swapPicks.includes(i) ? "acard-swapsel" : ""} onClick={() => (swapMode ? toggleSwapPick(i) : setMyPick(myPick === c ? null : c))} />
                        </div>
                      ))}
                    </div>
                    {showRightArrow && (
                      <button 
                        type="button" 
                        className="hand-scroll-arrow right" 
                        onClick={() => handRef.current?.scrollBy({ left: 140, behavior: 'smooth' })}
                        aria-label="Scroll right"
                      >
                        ›
                      </button>
                    )}
                  </div>
                  <div className={"confirm-bar" + (swapMode || myPick ? " confirm-show" : "")}>
                    {swapMode ? (
                      <div className="swap-actions">
                        <Btn big={true} variant="accent" disabled={!swapPicks.length} onClick={doSwap}>Lock in swap{swapPicks.length ? ` (${swapPicks.length})` : ""}</Btn>
                        <Btn big={true} variant="secondary" onClick={() => { setSwapMode(false); setSwapPicks([]); }}>Cancel</Btn>
                      </div>
                    ) : (
                      <Btn big={true} variant="accent" onClick={() => handleSubmitCard(myPick!)}>Lock it in</Btn>
                    )}
                  </div>
                </React.Fragment>
              ) : (
                <div className="waiting-area">
                  <div className="pile">
                    {subs.map((s: any, i: number) => (
                      <div key={s.uid} className="pile-slot" style={{ "--r": ((i % 5) - 2) * 5 + "deg" } as React.CSSProperties}>
                        <FlipCard text={s.text} flipped={false} />
                      </div>
                    ))}
                  </div>
                  <p className="waiting-text">Card in. Waiting on {needed - subs.length} more<span className="dots"><i>.</i><i>.</i><i>.</i></span></p>
                </div>
              )}
            </main>
          ) : null}

          {/* PICK — you are judge */}
          {phase === "pick" && youAreJudge ? (
            <main className="game-main">
              <div className="judge-banner">
                <span className="judge-banner-crown"><CrownIcon /></span>
                You're the judge this round — sit back while everyone scrambles
              </div>
              <div className="stage">
                <PromptCard text={prompt} className="stage-prompt" />
                <div className="status-row">
                  {players.filter(p => p.id !== judge.id).map((p) => {
                    const isDisconnected = p.isConnected === false;
                    return (
                      <div key={p.id} style={{ position: 'relative', opacity: isDisconnected ? 0.4 : 1 }} title={isDisconnected ? `${p.name} (Disconnected)` : undefined}>
                        <Avatar player={p} size={34} done={!isDisconnected && submittedUids.includes(p.id)} dim={!isDisconnected && !submittedUids.includes(p.id)} />
                        {isDisconnected && (
                          <span style={{ position: 'absolute', bottom: -2, right: -2, background: '#ff4d4f', width: 8, height: 8, borderRadius: '50%', border: '2px solid #141414' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="waiting-area">
                <div className="pile">
                  {subs.map((s: any, i: number) => (
                    <div key={s.uid} className="pile-slot" style={{ "--r": ((i % 5) - 2) * 5 + "deg" } as React.CSSProperties}>
                      <FlipCard text={s.text} flipped={false} />
                    </div>
                  ))}
                </div>
                <p className="waiting-text">{subs.length} of {needed} answers in<span className="dots"><i>.</i><i>.</i><i>.</i></span></p>
              </div>
            </main>
          ) : null}

          {/* JUDGING */}
          {phase === "judging" ? (
            <main className="game-main">
              <TimerBar seconds={timeLeft} total={settings.timer} />
              <div className="stage stage-judging">
                <PromptCard text={prompt} small={true} className="stage-prompt" />
                <h2 className="judging-title">
                  {youAreJudge ? (
                    <span className="text-glow-gold">👑 Pick the funniest answer</span>
                  ) : (
                    <React.Fragment>{judge.name} is deciding<span className="dots"><i>.</i><i>.</i><i>.</i></span></React.Fragment>
                  )}
                </h2>
              </div>
              <div className="judge-grid">
                {subs.map((s: any, i: number) => (
                  <FlipCard key={s.uid} text={s.text} flipped={flipped} delay={i * 0.42 + "s"} clickable={youAreJudge && flipped} onClick={() => handleCrown(s.uid)} />
                ))}
              </div>
              {youAreJudge ? <p className="judging-hint">Answers are anonymous — tap a card to crown the winner</p> : null}
            </main>
          ) : null}

          {/* REVEAL */}
          {phase === "reveal" ? (
            <main className="game-main reveal">
              {gameState?.winnerUid !== 'none' && winner && <ConfettiBurst count={110} />}
              {gameState?.winnerUid !== 'none' && winner ? (
                <div className="winbanner">
                  <Avatar player={winner} size={56} />
                  <div className="winbanner-text">
                    <span className="winbanner-name">{winner.isYou ? "You win the round!" : winner.name + " wins the round!"}</span>
                    <span className="winbanner-sub">crowned by {judge.isYou ? "you" : judge.name}</span>
                  </div>
                  <span className="plusone">+1</span>
                </div>
              ) : gameState?.winnerUid === 'none' ? (
                <div className="winbanner" style={{ background: '#ff4d4f', color: '#fff' }}>
                  <div className="winbanner-text" style={{ paddingLeft: '8px' }}>
                    <span className="winbanner-name">The judge has failed us!</span>
                    <span className="winbanner-sub">No card was crowned in time. No points awarded.</span>
                  </div>
                </div>
              ) : null}
              <PromptCard text={prompt} fill={winnerSub ? winnerSub.text : ""} className="reveal-prompt" />
              <div className="reveal-others">
                {subs.map((s: any) => {
                  const isWinner = s.uid === gameState?.winnerUid;
                  const submitter = roomPlayers.find(p => p.uid === s.uid) || { name: s.name, color: '#ccc' };
                  return (
                    <div key={s.uid} className="reveal-card-wrapper">
                      <AnswerCard
                        text={s.text}
                        small={true}
                        dimmed={!isWinner && gameState?.winnerUid !== 'none'}
                        winner={isWinner}
                      />
                      <div className="reveal-card-submitter" style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: isWinner ? 1 : 0.6 }}>
                        <Avatar player={submitter} size={16} />
                        <span style={{ fontSize: '11px', fontWeight: isWinner ? 700 : 500, color: isWinner ? '#FFC93C' : 'inherit' }}>
                          {submitter.name || s.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="reveal-foot">
                <ReactionBar onReact={handleSendReaction} />
                {isHost ? (
                  <Btn big={true} onClick={handleNext}>{gameOver ? "See final results" : "Next round"}</Btn>
                ) : (
                  <span className="waiting-host" style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                    Waiting for host to start next round<span className="dots"><i>.</i><i>.</i><i>.</i></span>
                  </span>
                )}
              </div>
            </main>
          ) : null}
        </div>

        {/* Right chat sidebar / drawer */}
        {chatOpen && (
          <>
            <div className="chat-scrim" onClick={() => setChatOpen(false)}></div>
            <aside className="lobby-chat game-chat-drawer">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 className="lobby-sec-title" style={{ margin: 0 }}>Chat</h3>
                <button className="iconbtn" onClick={() => setChatOpen(false)} aria-label="Close chat">
                  <X size={18} />
                </button>
              </div>
              <div className="chat-msgs">
                {chatMessages.map((m) => {
                  const isMe = m.uid === myUid;
                  return (
                    <div key={m.id} className={"chat-msg" + (isMe ? " chat-mine" : "")}>
                      <Avatar player={{ name: isMe ? "You" : m.name, color: m.color }} size={26} />
                      <span className="chat-bubble"><b>{isMe ? "You" : m.name}</b> {m.text}</span>
                    </div>
                  );
                })}
                {chatMessages.length === 0 ? <p className="muted chat-empty">Say hi in-game…</p> : null}
                <div ref={chatBottomRef} />
              </div>
              <div className="chat-inputrow">
                <input
                  className="input chat-input"
                  placeholder="Message…"
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendGameChat(); }}
                />
                <Btn onClick={sendGameChat}>Send</Btn>
              </div>
            </aside>
          </>
        )}
      </div>
      <ReactionLayer />

      <ConfirmModal
        open={showLeaveConfirm}
        title="Leave Game?"
        desc="Are you sure you want to leave the game? Your current score and progress will be lost."
        confirmText="Leave Game"
        confirmVariant="danger"
        onConfirm={handleLeaveGame}
        onClose={() => setShowLeaveConfirm(false)}
      />

      <ConfirmModal
        open={showEndConfirm}
        title="End Game?"
        desc="Are you sure you want to end the game for everyone? This will abort the session for all connected players."
        confirmText="End Game"
        confirmVariant="danger"
        onConfirm={handleEndGame}
        onClose={() => setShowEndConfirm(false)}
      />

      <FeedbackModal
        open={showAbortFeedbackModal}
        showReward={false}
        code={code}
        onClose={() => router.replace('/')}
        onSubmitted={() => router.replace('/')}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ROOT: renders multiplayer game component
// ─────────────────────────────────────────────────────────────────
export default function GamePage() {
  const params = useParams();
  const code = ((params?.code as string) || "GRUV").toUpperCase();
  const { isHydrated, isPacksLoaded } = useGameContext();

  if (!isHydrated || !isPacksLoaded) {
    return (
      <div className="screen center-screen">
        <div className="waiting-text">Connecting<span className="dots"><i>.</i><i>.</i><i>.</i></span></div>
      </div>
    );
  }

  return <MultiplayerGame code={code} />;
}

// ─────────────────────────────────────────────────────────────────
// CONFIRM MODAL COMPONENT (frosted-glass premium overlay)
// ─────────────────────────────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean;
  title: string;
  desc: string;
  confirmText: string;
  cancelText?: string;
  confirmVariant?: "primary" | "secondary" | "ghost" | "accent" | "danger";
  onConfirm: () => void;
  onClose: () => void;
}

function ConfirmModal({ open, title, desc, confirmText, cancelText, confirmVariant, onConfirm, onClose }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <React.Fragment>
      <div className="scrim scrim-open" style={{ zIndex: 110 }} onClick={onClose}></div>
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 111,
        background: 'var(--paper)',
        color: 'var(--paper-fg)',
        borderRadius: '24px',
        padding: '30px 32px',
        width: '400px',
        maxWidth: '90vw',
        boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
        border: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '22px', fontWeight: 800, margin: 0 }}>{title}</h3>
        <p style={{ fontSize: '14px', opacity: 0.7, lineHeight: 1.4, margin: '4px 0 16px' }}>{desc}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={onClose}>{cancelText || "Cancel"}</Btn>
          <button 
            className="btn"
            style={{
              background: confirmVariant === "danger" ? "#ff4d4f" : "var(--dark)",
              color: "#fff",
              border: 0,
              padding: '10px 20px',
              borderRadius: '999px',
              fontWeight: 700,
              fontFamily: 'var(--font-d)'
            }}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}
