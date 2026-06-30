"use client";

import React, { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { Avatar, Coin, Btn, ConfettiBurst } from '@/components/components';
import FeedbackModal from '@/components/FeedbackModal';

export default function EndPage() {
  const router = useRouter();
  const { endData, replay, isHydrated, account } = useGameContext();
  const [roomData, setRoomData] = useState<any>(null);

  useEffect(() => {
    if (isHydrated && !endData) {
      router.replace('/');
    }
  }, [isHydrated, endData, router]);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    if (!endData) return;
    if (typeof window !== 'undefined' && window.navigator.webdriver) return;
    const timer = setTimeout(() => {
      if (!ratingSubmitted) {
        setShowFeedbackModal(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [endData, ratingSubmitted]);

  useEffect(() => {
    if (!isHydrated || !endData || !endData.code) return;
    
    let unsubscribe: () => void = () => {};
    
    async function listenToRoom() {
      const { subscribeRoom } = await import('@/firebase/firestore');
      unsubscribe = subscribeRoom(endData.code, (roomData) => {
        if (!roomData || roomData.status === 'closed') {
          router.push('/');
          return;
        }
        setRoomData(roomData);
        if (roomData.status === 'lobby') {
          router.push(`/lobby/${endData.code}`);
        }
      });
    }
    
    listenToRoom();
    return () => unsubscribe();
  }, [isHydrated, endData, router]);

  const myUid = account?.uid || account?.email || "guest";

  const sorted = useMemo(() => {
    if (!endData) return [];
    return [...endData.players].sort((a, b) => b.score - a.score);
  }, [endData]);

  const isHost = useMemo(() => {
    if (roomData) return roomData.hostUid === myUid;
    return sorted.find(p => p.isYou)?.isHost || false;
  }, [roomData, myUid, sorted]);

  const stats = useMemo(() => {
    if (!endData || sorted.length === 0) return [];
    const out: any[] = [];
    
    if (sorted[0]) {
      out.push({ label: "Champion", value: sorted[0].name, detail: sorted[0].score + " points" });
    }

    // Longest winning streak
    let best: { pid: string; name: string; len: number } | null = null;
    let cur: { pid: string; name: string; len: number } | null = null;
    
    endData.history.forEach((h) => {
      if (cur && cur.pid === h.pid) {
        cur.len += 1;
      } else {
        cur = { pid: h.pid, name: h.name, len: 1 };
      }
      if (!best || cur.len > best.len) {
        best = { ...cur };
      }
    });

    if (best && best.len > 1) {
      out.push({ label: "Hot streak", value: best.name, detail: best.len + " wins in a row" });
    }

    if (endData.history.length > 0) {
      const line = endData.history[Math.floor(Math.random() * endData.history.length)];
      out.push({ label: "Line of the night", value: `“${line.answer}”`, detail: "by " + line.name, wide: true });
    }

    return out;
  }, [endData, sorted]);

  if (!isHydrated || !endData || sorted.length === 0) {
    return (
      <div className="screen center-screen">
        <div className="waiting-text">Loading results...</div>
      </div>
    );
  }

  const podium = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
  const heights = sorted.length >= 3 ? [150, 200, 116] : [150, 200];
  const places = sorted.length >= 3 ? ["2nd", "1st", "3rd"] : ["2nd", "1st"];
  const rest = sorted.slice(3);
  const motion = 10; // Default motion speed

  const handleReplay = async () => {
    if (!endData) return;
    if (isHost) {
      const { resetRoomForReplay } = await import('@/firebase/firestore');
      await resetRoomForReplay(endData.code, myUid);
    }
  };

  const handleHome = async () => {
    if (isHost && endData?.code) {
      try {
        const { updateRoom } = await import('@/firebase/firestore');
        await updateRoom(endData.code, { status: 'closed' });
      } catch (e) {
        console.error("Failed to close room", e);
      }
    }
    router.push('/');
  };

  return (
    <div className="screen endscreen" data-screen-label="Final Results">
      <ConfettiBurst count={Math.round((motion / 10) * 160)} />
      <div className="end-inner">
        <h1 className="end-title">That's the game!</h1>
        <p className="end-sub">
          {sorted[0] && sorted[0].isYou
            ? "You are officially the funniest person here."
            : sorted[0].name + " is officially the funniest person here."}
        </p>
        {endData.earned ? (
          <p className="end-earn"><Coin size={16} /> +{endData.earned} coins earned</p>
        ) : null}

        <div className="podium">
          {podium.map((p, i) => (
            <div
              key={p.id}
              className="podium-col"
              style={{ "--dl": i * 0.18 + 0.2 + "s" } as React.CSSProperties}
            >
              <Avatar player={p} size={i === 1 ? 64 : 48} judge={i === 1} />
              <span className="podium-name">{p.name}{p.isYou ? " (you)" : ""}</span>
              <span className="podium-pts">{p.score} pts</span>
              <div className="podium-block" style={{ height: heights[i] }}>
                <span className="podium-place">{places[i]}</span>
              </div>
            </div>
          ))}
        </div>

        {rest.length ? (
          <ul className="end-rest">
            {rest.map((p, i) => (
              <li key={p.id} className="end-rest-row">
                <span className="scorerow-rank">{i + 4}</span>
                <Avatar player={p} size={30} />
                <span className="scorerow-name">{p.name}{p.isYou ? " (you)" : ""}</span>
                <span className="scorerow-pts">{p.score}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="end-stats">
          {stats.map((s: any) => (
            <div key={s.label} className={"stat-card" + (s.wide ? " stat-wide" : "")}>
              <span className="stat-label">{s.label}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-detail">{s.detail}</span>
            </div>
          ))}
        </div>

        {!ratingSubmitted && <RateRound onSubmitted={() => setRatingSubmitted(true)} />}

        <div className="end-actions">
          {isHost ? (
            <Btn big={true} onClick={handleReplay}>Play again</Btn>
          ) : (
            <Btn big={true} disabled={true}>Waiting for host...</Btn>
          )}
          <Btn big={true} variant="secondary" onClick={handleHome}>Back to start</Btn>
        </div>
      </div>
      <FeedbackModal
        open={showFeedbackModal}
        showReward={true}
        code={endData?.code || null}
        onClose={() => setShowFeedbackModal(false)}
        onSubmitted={() => setRatingSubmitted(true)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// END OF GAME RATING COMPONENT
// ─────────────────────────────────────────────────────────────────
interface RateRoundProps {
  onSubmitted: () => void;
}

function RateRound({ onSubmitted }: RateRoundProps) {
  const { endData, account, buyCredits } = useGameContext();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const labels = ["", "Meh", "Okay", "Good", "Great", "Hilarious"];
  const shown = hover || rating;

  const getOptionsForRating = (num: number) => {
    if (num <= 2) {
      return [
        "Encountered bugs / glitches",
        "Cards were not funny",
        "Gameplay felt too slow",
        "UI was hard to navigate"
      ];
    } else if (num === 3) {
      return [
        "Need more card variety",
        "Decent, but needs polish",
        "Lobby settings were limited",
        "Bots could be improved"
      ];
    } else {
      return [
        "Loved the card humor!",
        "Super smooth gameplay",
        "Beautiful & clean UI",
        "Bots made it fun to play"
      ];
    }
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
  };

  async function submit(rVal: number, reasonsVal: string[]) {
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: rVal,
          reasons: reasonsVal,
          comment: "",
          uid: account?.uid || null,
          email: account?.email || null,
          code: endData?.code || null,
          type: 'game-end',
        })
      });
      if (response.ok) {
        setSent(true);
        
        // Award 5 coins for sharing feedback
        if (account) {
          try {
            if (account.guest) {
              buyCredits({ coins: 5, tag: "Feedback bonus" });
            }
          } catch (creditsErr) {
            console.error("Failed to credit feedback coins:", creditsErr);
          }
        }

        const { logAnalyticsEvent } = await import('@/firebase/config');
        logAnalyticsEvent('game_end_rating', {
          rating: rVal,
          reasons: reasonsVal.join(','),
          code: endData?.code || null,
          rewarded: true
        });

        setTimeout(() => {
          onSubmitted();
        }, 2500);
      } else {
        console.error('Failed to submit end-of-game rating');
      }
    } catch (err) {
      console.error('Rating submit error:', err);
    }
  }

  const handleStarClick = (num: number) => {
    setRating(num);
    setSelectedReasons([]);
  };

  if (sent) {
    return (
      <div className="rate rate-done" style={{ textAlign: 'center' }}>
        <span className="rate-check">✓</span>
        <span className="rate-thanks">Thanks for rating!</span>
        <div style={{ marginTop: '14px', fontSize: '13px', opacity: 0.8, lineHeight: 1.45 }}>
          Want to suggest new features or report bugs?
          <br />
          <Link href="/feedback" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'underline', marginTop: '6px', display: 'inline-block' }}>
            Share on our feedback board →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rate">
      <span className="rate-q">How was that game?</span>
      
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255, 201, 60, 0.08)',
          border: '1px solid rgba(255, 201, 60, 0.2)',
          borderRadius: '8px',
          padding: '6px 12px',
          margin: '4px 0 10px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--accent)'
        }}
      >
        <Coin size={12} /> Earn 5 coins for sharing your thoughts!
      </div>

      <div className="rate-stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={"rate-star" + (n <= shown ? " rate-star-on" : "")}
            onMouseEnter={() => setHover(n)}
            onClick={() => handleStarClick(n)}
            aria-label={n + " star" + (n > 1 ? "s" : "")}
          >
            ★
          </button>
        ))}
      </div>
      <span className="rate-label">{labels[shown] || "\u00A0"}</span>

      {rating > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '12px', width: '100%' }}>
          <span style={{ fontSize: '13px', opacity: 0.8, marginBottom: '8px', fontWeight: 600 }}>
            {rating <= 2 ? "What went wrong?" : rating === 3 ? "How can we improve?" : "What did you love?"}
          </span>
          <div className="rate-chips">
            {getOptionsForRating(rating).map((opt) => {
              const isSelected = selectedReasons.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={`rate-chip ${isSelected ? 'rate-chip-selected' : ''}`}
                  onClick={() => toggleReason(opt)}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="rate-submit-btn"
            disabled={selectedReasons.length === 0}
            onClick={() => submit(rating, selectedReasons)}
          >
            Submit Feedback
          </button>
        </div>
      )}
    </div>
  );
}
