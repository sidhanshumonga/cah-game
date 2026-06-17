"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { Logo, Avatar, Btn, Coin } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';
import { isFirebaseEnabled } from '@/firebase/config';

interface ChatMessage {
  id: string;
  uid: string;
  name: string;
  color: string;
  text: string;
}

interface RoomPlayer {
  uid: string;
  name: string;
  color: string;
  score: number;
  ready: boolean;
  isHost: boolean;
  isConnected?: boolean;
}

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const code = ((params?.code as string) || "ABCD").toUpperCase();

  const { mode, settings, setSettings, setAccount, startGame, isHydrated, isPacksLoaded, account, getCardsForPacks, packs } = useGameContext();

  // ── Guest Join state ──────────────────────────────────────────────────────
  const [guestName, setGuestName] = useState("");
  const [guestColor, setGuestColor] = useState("#FF5C39");

  const handleGuestJoin = () => {
    if (!guestName.trim()) return;
    const guestEmail = `${guestName.trim().toLowerCase()}-${Math.floor(1000 + Math.random() * 9000)}@guest.example.com`;
    setAccount({
      name: guestName.trim(),
      email: guestEmail,
      color: guestColor,
      guest: true,
      credits: 50,
      packs: ["classic"],
      upgrades: [],
      history: [],
      wins: 0,
      games: 0,
      createdAt: Date.now(),
    });
  };

  // ── Multiplayer state (Firestore) ─────────────────────────────────────────
  const [isMultiplayer, setIsMultiplayer] = useState(true);
  const [roomPlayers, setRoomPlayers] = useState<RoomPlayer[]>([]);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [shareUrl, setShareUrl] = useState(`cah-game.com/lobby/${code}`);
  const [fullUrl, setFullUrl] = useState(`https://cah-game.com/lobby/${code}`);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      const origin = window.location.origin;
      setShareUrl(`${host}/lobby/${code}`);
      setFullUrl(`${origin}/lobby/${code}`);
    }
  }, [code]);
  const [roomStatus, setRoomStatus] = useState<string>('lobby');
  const [roomExists, setRoomExists] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Refs for tracking status across unmount
  const statusRef = useRef('lobby');

  const isHost = mode === "host";

  // Keep statusRef synced with roomStatus
  useEffect(() => {
    statusRef.current = roomStatus;
  }, [roomStatus]);

  // ── Detect if this is a real Firestore room ───────────────────────────────
  useEffect(() => {
    if (!isFirebaseEnabled || !isHydrated) return;

    async function detectRoom() {
      try {
        const { getRoomDoc } = await import('@/firebase/firestore');
        const roomData = await getRoomDoc(code);
        if (roomData) {
          setIsMultiplayer(true);
          setRoomStatus(roomData.status);
          setRoomExists(true);
          if (roomData.settings) {
            setSettings(roomData.settings);
          }
          setRoomLoaded(true);
        } else {
          setRoomExists(false);
          setRoomLoaded(true);
        }
      } catch (e) {
        console.error("Failed to detect room", e);
        setRoomExists(false);
        setRoomLoaded(true);
      }
    }
    detectRoom();
  }, [code, isFirebaseEnabled, isHydrated, setSettings]);

  // ── MULTIPLAYER MODE: subscribe to room, players, chat ───────────────────
  useEffect(() => {
    if (!isMultiplayer || !isHydrated) return;
    const subs: (() => void)[] = [];

    async function setupSubscriptions() {
      const { subscribeRoom, subscribeRoomPlayers, subscribeRoomChat, joinRoom } = await import('@/firebase/firestore');

      // Subscribe to room doc (to detect game start & settings sync)
      subs.push(subscribeRoom(code, (data) => {
        if (!data) {
          setRoomExists(false);
          return;
        }
        setRoomExists(true);
        setRoomStatus(data.status);
        if (data.settings) {
          setSettings(data.settings);
        }
        if (data.status === 'playing') {
          router.push(`/game/${code}`);
        } else if (data.status === 'ended' || data.status === 'completed') {
          setRoomStatus(data.status);
        }
      }));

      // Subscribe to players
      subs.push(subscribeRoomPlayers(code, (players) => {
        setRoomPlayers(players);
      }));

      // Subscribe to chat
      subs.push(subscribeRoomChat(code, (messages) => {
        setMsgs(messages.map((m: any) => ({
          id: m.id,
          uid: m.uid,
          name: m.name,
          color: m.color,
          text: m.text,
        })));
      }));

      // Join this room (add self to players subcollection)
      if (account && !hasJoined) {
        const uid = account.uid || account.email;
        const hostUid = await getHostUid(code);
        await joinRoom(code, {
          uid,
          name: account.name,
          color: account.color,
          isHost: uid === hostUid,
        });
        setHasJoined(true);
      }
    }

    setupSubscriptions();
    return () => subs.forEach(u => u());
  }, [isMultiplayer, isHydrated, code, account, router, hasJoined, setSettings]);

  async function getHostUid(roomCode: string): Promise<string> {
    try {
      const { getRoomDoc } = await import('@/firebase/firestore');
      const data = await getRoomDoc(roomCode);
      return data?.hostUid || '';
    } catch {
      return '';
    }
  }

  // ── Leave room on unmount (multiplayer) ───────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer || !account) return;
    return () => {
      if (statusRef.current !== 'playing') {
        const uid = account.uid || account.email;
        import('@/firebase/firestore').then(({ leaveRoom }) => {
          leaveRoom(code, uid).catch(() => {});
        });
      }
    };
  }, [isMultiplayer, code, account]);

  // ── Connection state tracking (multiplayer) ───────────────────────────────
  useEffect(() => {
    if (!isMultiplayer || !account) return;
    const uid = account.uid || account.email;

    import('@/firebase/firestore').then(({ updatePlayerConnection }) => {
      updatePlayerConnection(code, uid, true).catch(() => {});
    });

    const handleDisconnect = () => {
      import('@/firebase/firestore').then(({ updatePlayerConnection }) => {
        updatePlayerConnection(code, uid, false).catch(() => {});
      });
    };

    window.addEventListener('beforeunload', handleDisconnect);
    window.addEventListener('pagehide', handleDisconnect);

    return () => {
      window.removeEventListener('beforeunload', handleDisconnect);
      window.removeEventListener('pagehide', handleDisconnect);
      if (statusRef.current !== 'playing') {
        handleDisconnect();
      }
    };
  }, [isMultiplayer, code, account]);

  // ── Auto scroll chat to bottom ────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const copy = (text: string, which: string) => {
    try { navigator.clipboard.writeText(text); } catch (e) {}
    setCopied(which);
    setTimeout(() => setCopied(null), 1400);
  };

  const kick = async (uid: string) => {
    const { kickPlayer } = await import('@/firebase/firestore');
    await kickPlayer(code, uid);
  };

  const sendChat = async () => {
    if (!draft.trim() || !account) return;
    const { sendChatMessage } = await import('@/firebase/firestore');
    await sendChatMessage(code, account.uid || account.email, account.name, account.color, draft.trim());
    setDraft("");
  };

  const handleLeave = async () => {
    if (isRealHost) {
      const { updateRoom } = await import('@/firebase/firestore');
      await updateRoom(code, { status: 'ended' });
    }
    router.push('/');
  };

  const handleStart = async () => {
    if (isMultiplayer) {
      // Write game started status to Firestore — all clients will navigate via subscription
      try {
        const { updateRoom, startGame: fsStartGame } = await import('@/firebase/firestore');
        let currentPlayers = [...roomPlayers];
        const players = currentPlayers.map(p => p.uid);
        const scores: Record<string, number> = {};
        currentPlayers.forEach(p => { scores[p.uid] = 0; });
        const cardPools = getCardsForPacks(settings.packs, settings.family);
        const prompts = cardPools.prompts;
        const prompt = prompts[Math.floor(Math.random() * prompts.length)] || "Cards Against Humanity round!";
        const nonHost = players.filter(uid => uid !== (account?.uid || account?.email));
        const judgeOrder = [players[0], ...nonHost];
        await fsStartGame(code, 1, prompt, judgeOrder[0], judgeOrder, scores);
        await updateRoom(code, { status: 'playing' });
      } catch (e) {
        console.error("Failed to start game", e);
      }
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const myUid = account?.uid || account?.email || "you";
  const isRealHost = roomPlayers.find(p => p.uid === myUid)?.isHost ?? false;

  const displayPlayers = roomPlayers;
  const displayMsgs = msgs;
  const canStart = roomPlayers.length >= 2;
  const slots = Math.min(settings.maxPlayers, 8);

  if (!isHydrated || !isPacksLoaded || !roomLoaded) {
    return (
      <div className="screen center-screen">
        <div className="waiting-text">Loading lobby...</div>
      </div>
    );
  }

  if (roomExists === false) {
    return (
      <div className="screen center-screen" data-screen-label="Lobby Not Found Screen">
        <div className="panel" style={{ maxWidth: '440px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px', color: '#ff4d4f' }}>Room Not Found</h2>
          <p className="muted" style={{ margin: '0 0 24px', fontSize: '15px', lineHeight: 1.4 }}>This game lobby or room does not exist.</p>
          <Btn big={true} onClick={() => router.push('/')}>Back to Homepage</Btn>
        </div>
      </div>
    );
  }

  if (roomStatus === 'ended' || roomStatus === 'completed') {
    const isCompleted = roomStatus === 'completed';
    return (
      <div className="screen center-screen" data-screen-label="Lobby Ended Screen">
        <div className="panel" style={{ maxWidth: '440px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 10px', color: isCompleted ? '#2bc4be' : '#ff4d4f' }}>
            {isCompleted ? "Game Completed" : "Room Closed"}
          </h2>
          <p className="muted" style={{ margin: '0 0 24px', fontSize: '15px', lineHeight: 1.4 }}>
            {isCompleted 
              ? "This game session has finished normally." 
              : "The host has ended the session or left the lobby."}
          </p>
          <Btn big={true} onClick={() => router.push('/')}>Back to Homepage</Btn>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="screen center-screen" data-screen-label="Join Room Guest form">
        <div className="auth" style={{ maxWidth: '400px', width: '100%' }}>
          <h2 className="auth-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Join room {code}</h2>
          <p className="auth-sub" style={{ fontSize: '14px', marginBottom: '24px', opacity: 0.7 }}>Enter your name and choose a color to join the party.</p>
          
          <div className="frow" style={{ marginBottom: '20px' }}>
            <label className="flabel" style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Your name</label>
            <input
              className="input"
              maxLength={14}
              placeholder="Name..."
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div className="frow" style={{ marginBottom: '24px' }}>
            <label className="flabel" style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Your avatar color</label>
            <div className="colorrow">
              {["#FF5C39", "#7C5CFF", "#2BC4BE", "#FF4D8D", "#5CA9FF", "#FFC93C"].map((color) => (
                <button
                  key={color}
                  onClick={() => setGuestColor(color)}
                  className={"colordot" + (guestColor === color ? " colordot-on" : "")}
                  style={{ background: color }}
                  type="button"
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Btn big={true} disabled={!guestName.trim()} onClick={handleGuestJoin}>
              Join Game
            </Btn>
            <Btn big={true} variant="secondary" onClick={() => router.push(`/login?redirectTo=/lobby/${code}`)}>
              Sign in with Google
            </Btn>
            <button className="linkbtn" onClick={() => router.push('/')} style={{ marginTop: '8px', opacity: 0.6 }}>
              ← Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen lobby" data-screen-label="Lobby">
      <div className="lobby-head">
        <Logo />
        <div className="lobby-code">
          <span className="lobby-code-label">Room code</span>
          <div className="lobby-code-val" style={{ cursor: 'default', paddingRight: '18px' }}>
            {code}
          </div>
        </div>
        <button className="chip" onClick={() => copy(fullUrl, "link")} title="Copy invite link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {copied === "link" ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Link copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              {shareUrl}
            </>
          )}
        </button>
        {isMultiplayer && (
          <span className="chip" style={{ background: 'rgba(44,196,190,0.15)', color: '#2BC4BE' }}>
            🔴 Live
          </span>
        )}
        <button className="iconbtn lobby-leave" onClick={handleLeave} aria-label="Leave room">✕</button>
      </div>

      <div className="lobby-grid">
        <section className="lobby-main">
          <h3 className="lobby-sec-title">
            Players <span className="muted">{displayPlayers.length} / {settings.maxPlayers}</span>
          </h3>
          <div className="ptiles">
            {displayPlayers.map((p: any) => {
              const pid = p.uid;
              const pname = p.name;
              const isYou = pid === myUid;
              const isPlayerHost = p.isHost;
              const isDisconnected = p.isConnected === false;
              const isReady = p.ready;
              return (
                <div key={pid} className="ptile" style={isDisconnected ? { opacity: 0.5 } : undefined}>
                  <Avatar player={{ name: pname, color: p.color }} size={52} judge={isPlayerHost} done={!isDisconnected && !!isReady} />
                  <span className="ptile-name">{pname}{isYou ? " (you)" : ""}</span>
                  <span className={"ptile-status" + (isDisconnected ? " muted" : isReady ? " ptile-ready" : "")}>
                    {isDisconnected ? "Reconnecting…" : isReady ? "Ready" : "Joining…"}
                  </span>
                  {isRealHost && !isYou && (
                    <button className="ptile-kick" onClick={() => kick(pid)} title="Remove player">✕</button>
                  )}
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, slots - displayPlayers.length) }, (_, i) => (
              <div key={"e" + i} className="ptile ptile-empty">
                <span className="ptile-empty-circle"></span>
                <span className="ptile-name muted">Waiting…</span>
              </div>
            ))}
          </div>

          <div className="lobby-settings">
            <span className="chip">First to {settings.scoreLimit} pts</span>
            <span className="chip">{settings.timer}s timer</span>
            <span className="chip">
              {settings.packs.length} pack{settings.packs.length > 1 ? "s" : ""}: {(() => {
                const selectedNames = settings.packs.map(id => {
                  const p = packs.find(pkg => pkg.id === id);
                  return p ? p.name : id;
                });
                return selectedNames.length > 2
                  ? selectedNames.slice(0, 2).join(", ") + " +" + (selectedNames.length - 2) + " more"
                  : selectedNames.join(", ");
              })()}
            </span>
            {settings.family ? <span className="chip">Family-friendly</span> : null}
            {settings.custom ? <span className="chip">Custom cards on</span> : null}
          </div>

          <div className="lobby-cta">
            {isRealHost ? (
              <Btn big={true} disabled={!canStart} onClick={handleStart}>
                {canStart ? "Start game" : "Need at least 2 players…"}
              </Btn>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Btn big={true} onClick={async () => {
                  const { updatePlayerReady } = await import('@/firebase/firestore');
                  const myPlayer = roomPlayers.find(p => p.uid === myUid);
                  await updatePlayerReady(code, myUid, !myPlayer?.ready);
                }}>
                  {roomPlayers.find(p => p.uid === myUid)?.ready ? "Cancel Ready" : "I'm ready"}
                </Btn>
                <span className="waiting-host">
                  Waiting for host to start<span className="dots"><i>.</i><i>.</i><i>.</i></span>
                </span>
              </div>
            )}
          </div>
        </section>

        <aside className="lobby-chat">
          <h3 className="lobby-sec-title">Chat</h3>
          <div className="chat-msgs">
            {displayMsgs.map((m) => {
              const isMe = m.uid === myUid;
              return (
                <div key={m.id} className={"chat-msg" + (isMe ? " chat-mine" : "")}>
                  <Avatar player={{ name: isMe ? "You" : m.name, color: m.color }} size={26} />
                  <span className="chat-bubble"><b>{isMe ? "You" : m.name}</b> {m.text}</span>
                </div>
              );
            })}
            {displayMsgs.length === 0 ? <p className="muted chat-empty">Say hi while everyone joins…</p> : null}
            <div ref={chatBottomRef} />
          </div>
          <div className="chat-inputrow">
            <input
              className="input chat-input"
              placeholder="Message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
            />
            <Btn onClick={sendChat}>Send</Btn>
          </div>
        </aside>
      </div>
    </div>
  );
}
