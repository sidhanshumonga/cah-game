"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useGameContext, maxPlayersFor, ownsPack } from '@/context/GameContext';
import { Logo, Avatar, Btn, Coin, LockIcon } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';
import { isFirebaseEnabled } from '@/firebase/config';
import { buildSeededDeck, getPromptForRound } from '@/utils/deck';

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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
        const deck = buildSeededDeck(settings.packs, packs, settings.family, code);
        const prompt = getPromptForRound(deck.prompts, code, 1);
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
            {isRealHost && (
              <button 
                type="button"
                className="chip" 
                style={{ background: 'var(--accent)', color: 'var(--dark)', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={() => setSettingsOpen(true)}
              >
                ⚙️ Edit Settings
              </button>
            )}
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

      <EditSettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={async (newSettings) => {
          const { updateRoom } = await import('@/firebase/firestore');
          await updateRoom(code, { settings: newSettings });
          setSettingsOpen(false);
        }}
        packs={packs}
        account={account}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SETTINGS HELPERS & EDIT MODAL
// ─────────────────────────────────────────────────────────────────
function Seg({ options, value, onChange, format }: {
  options: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (o: number) => string;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={"seg-btn" + (o === value ? " seg-on" : "")}
          onClick={() => onChange(o)}
        >
          {format ? format(o) : o}
        </button>
      ))}
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={"switch" + (on ? " switch-on" : "")}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    >
      <span className="switch-knob"></span>
    </button>
  );
}

interface EditSettingsModalProps {
  open: boolean;
  settings: any;
  onClose: () => void;
  onSave: (newSettings: any) => Promise<void>;
  packs: any[];
  account: any;
}

function EditSettingsModal({ open, settings, onClose, onSave, packs: allPacks, account }: EditSettingsModalProps) {
  const allowed = maxPlayersFor(account);
  const router = useRouter();
  const { buyPack } = useGameContext();
  
  const [maxPlayers, setMaxPlayers] = useState(settings.maxPlayers);
  const [scoreLimit, setScoreLimit] = useState(settings.scoreLimit);
  const [timer, setTimer] = useState(settings.timer);
  const [packs, setPacks] = useState<string[]>(settings.packs);
  const [family, setFamily] = useState(settings.family);
  const [packQuery, setPackQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [showBuyConfirmModal, setShowBuyConfirmModal] = useState(false);
  const [buyConfirmPack, setBuyConfirmPack] = useState<any | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);

  // Sync state if settings change in real-time
  useEffect(() => {
    if (open) {
      setMaxPlayers(settings.maxPlayers);
      setScoreLimit(settings.scoreLimit);
      setTimer(settings.timer);
      setPacks(settings.packs);
      setFamily(settings.family);
    }
  }, [open, settings]);

  // Adjust packs if family-friendly mode is toggled
  useEffect(() => {
    if (family) {
      setPacks((prev) => prev.filter(id => {
        const p = allPacks.find(pkg => pkg.id === id);
        return !p || p.familyFriendly !== false;
      }));
    }
  }, [family, allPacks]);

  if (!open) return null;

  const togglePack = (pId: string) => {
    setPacks((s) => {
      if (s.includes(pId)) return s.filter((x) => x !== pId);
      if (s.length >= 8) return s; // MAX_PACKS = 8
      return [...s, pId];
    });
  };

  const handleInstantBuy = async () => {
    if (!buyConfirmPack || !account) return;
    setBuyLoading(true);
    try {
      buyPack({
        id: buyConfirmPack.id,
        name: buyConfirmPack.name,
        price: buyConfirmPack.price || 0
      });
      
      setPacks((prev) => {
        if (prev.includes(buyConfirmPack.id)) return prev;
        if (prev.length >= 8) return prev;
        return [...prev, buyConfirmPack.id];
      });
      
      setShowBuyConfirmModal(false);
      setBuyConfirmPack(null);
    } catch (err) {
      console.error(err);
    } finally {
      setBuyLoading(false);
    }
  };

  const sortedFilteredPacks = allPacks
    .filter((p) => p.name.toLowerCase().includes(packQuery.trim().toLowerCase()))
    .sort((a, b) => {
      const ownA = ownsPack(account, a);
      const ownB = ownsPack(account, b);
      if (ownA && !ownB) return -1;
      if (!ownA && ownB) return 1;
      return a.name.localeCompare(b.name);
    });

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...settings,
        maxPlayers,
        scoreLimit,
        timer,
        packs,
        family,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <React.Fragment>
      <div className="scrim scrim-open" style={{ zIndex: 110 }} onClick={onClose}></div>
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 111,
        background: 'var(--dark)',
        color: 'var(--fg)',
        borderRadius: '24px',
        padding: '30px 32px',
        width: '760px',
        maxWidth: '92vw',
        maxHeight: '85vh',
        boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '22px', fontWeight: 800, margin: 0 }}>Edit Room Settings</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close" style={{ fontSize: '18px' }}>✕</button>
        </div>

        <div className="create-grid" style={{ margin: 0, gap: '24px' }}>
          {/* Basics Column */}
          <section className="create-col">
            <h4 className="create-sec" style={{ marginTop: 0 }}>Basics</h4>
            <div className="frow">
              <label className="flabel">Max players <span className="flabel-val">{maxPlayers}</span></label>
              <input
                className="range"
                type="range" min="3" max={allowed} step="1" value={maxPlayers}
                onChange={(e) => setMaxPlayers(+e.target.value)}
              />
            </div>
            <div className="frow">
              <label className="flabel">Points to win</label>
              <Seg options={[3, 5, 7]} value={scoreLimit} onChange={setScoreLimit} />
            </div>
            <div className="frow">
              <label className="flabel">Turn timer</label>
              <Seg options={[30, 45, 60]} value={timer} onChange={setTimer} format={(o) => o + "s"} />
            </div>
            <div className="frow frow-inline" style={{ marginBottom: '12px' }}>
              <label className="flabel">Family-friendly mode</label>
              <Switch on={family} onChange={setFamily} />
            </div>
          </section>

          {/* Card Packs Column */}
          <section className="create-col">
            <h4 className="create-sec" style={{ marginTop: 0 }}>Card Packs <span className="flabel-val">{packs.length} selected</span></h4>
            <div className="packbox" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="packbox-tools" style={{ padding: '8px' }}>
                <input
                  className="input packsearch"
                  placeholder="Search packs..."
                  value={packQuery}
                  onChange={(e) => setPackQuery(e.target.value)}
                  style={{ height: '36px', fontSize: '13px' }}
                />
              </div>
              <div className="packlist" style={{ maxHeight: '200px', padding: '8px' }}>
                {sortedFilteredPacks.map((p) => {
                  const owned = ownsPack(account, p);
                  const on = packs.includes(p.id);
                  const adultLocked = family && p.familyFriendly === false;
                  
                  if (!owned || adultLocked) {
                    return (
                      <button
                        key={p.id}
                        className="packchip packchip-locked"
                        style={{ opacity: adultLocked ? 0.5 : 1 }}
                        onClick={() => {
                          if (adultLocked) {
                            // Family-friendly locked, no instant unlock allowed
                          } else {
                            setBuyConfirmPack(p);
                            setShowBuyConfirmModal(true);
                          }
                        }}
                      >
                        <LockIcon size={11} /> {p.name}
                        {adultLocked ? (
                          <span className="packchip-price" style={{ color: 'var(--red)' }}>adult content</span>
                        ) : (
                          <span className="packchip-price"><Coin size={11} /> {p.price}</span>
                        )}
                      </button>
                    );
                  }
                  
                  return (
                    <button
                      key={p.id}
                      className={"packchip" + (on ? " packchip-on" : "")}
                      disabled={!on && packs.length >= 8}
                      onClick={() => togglePack(p.id)}
                    >
                      {p.name}<span className="packchip-count">{p.cards}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
          <Btn variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Btn>
          <Btn variant="accent" onClick={handleSaveClick} disabled={isSaving || packs.length === 0}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Btn>
        </div>
      </div>

      {showBuyConfirmModal && buyConfirmPack && (
        <div style={{ zIndex: 120, position: 'relative' }}>
          <div className="scrim scrim-open" style={{ zIndex: 120 }} onClick={() => setShowBuyConfirmModal(false)}></div>
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 121,
            background: 'var(--dark)',
            color: 'var(--fg)',
            borderRadius: '24px',
            padding: '30px 32px',
            width: '440px',
            maxWidth: '92vw',
            boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            textAlign: 'center'
          }}>
            {!account ? (
              <React.Fragment>
                <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '20px', fontWeight: 800, margin: 0 }}>Sign in to Unlock</h3>
                <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: 1.5, margin: 0 }}>
                  You need to sign in to purchase and unlock the <b>“{buyConfirmPack.name}”</b> expansion pack.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <Btn onClick={() => router.push('/login?redirectTo=' + window.location.pathname)}>Sign in with Google</Btn>
                  <Btn variant="secondary" onClick={() => setShowBuyConfirmModal(false)}>Cancel</Btn>
                </div>
              </React.Fragment>
            ) : account.credits >= (buyConfirmPack.price || 0) ? (
              <React.Fragment>
                <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '20px', fontWeight: 800, margin: 0 }}>Unlock Expansion Pack?</h3>
                <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: 1.5, margin: 0 }}>
                  Would you like to instantly unlock the <b>“{buyConfirmPack.name}”</b> pack for <Coin size={12} /> <b>{buyConfirmPack.price}</b> coins?
                </p>
                <p style={{ fontSize: '13px', opacity: 0.6, margin: '-4px 0 4px' }}>
                  Your balance: <Coin size={11} /> {account.credits} coins
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <Btn onClick={handleInstantBuy} disabled={buyLoading}>
                    {buyLoading ? "Unlocking..." : `Unlock Pack (–${buyConfirmPack.price})`}
                  </Btn>
                  <Btn variant="secondary" onClick={() => setShowBuyConfirmModal(false)} disabled={buyLoading}>Cancel</Btn>
                </div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--accent2)' }}>Not Enough Coins</h3>
                <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: 1.5, margin: 0 }}>
                  The <b>“{buyConfirmPack.name}”</b> pack costs <Coin size={12} /> <b>{buyConfirmPack.price}</b> coins, but you only have <Coin size={12} /> <b>{account.credits}</b> coins.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <Btn onClick={() => router.push('/coins')}>Get Coins</Btn>
                  <Btn variant="secondary" onClick={() => setShowBuyConfirmModal(false)}>Cancel</Btn>
                </div>
              </React.Fragment>
            )}
          </div>
        </div>
      )}
    </React.Fragment>
  );
}
