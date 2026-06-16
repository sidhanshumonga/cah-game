"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { Avatar, Coin, Btn, ConfettiBurst } from '@/components/components';

export default function EndPage() {
  const router = useRouter();
  const { endData, replay, isHydrated, account } = useGameContext();
  const [roomData, setRoomData] = useState<any>(null);

  useEffect(() => {
    if (isHydrated && !endData) {
      router.replace('/');
    }
  }, [isHydrated, endData, router]);

  useEffect(() => {
    if (!isHydrated || !endData || !endData.code) return;
    
    let unsubscribe: () => void = () => {};
    
    async function listenToRoom() {
      const { subscribeRoom } = await import('@/firebase/firestore');
      unsubscribe = subscribeRoom(endData.code, (roomData) => {
        if (!roomData) return;
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
  const isHost = roomData ? roomData.hostUid === myUid : false;

  const sorted = useMemo(() => {
    if (!endData) return [];
    return [...endData.players].sort((a, b) => b.score - a.score);
  }, [endData]);

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

  const handleHome = () => {
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

        <div className="end-actions">
          {isHost ? (
            <Btn big={true} onClick={handleReplay}>Play again</Btn>
          ) : (
            <Btn big={true} disabled={true}>Waiting for host...</Btn>
          )}
          <Btn big={true} variant="secondary" onClick={handleHome}>Back to start</Btn>
        </div>
      </div>
    </div>
  );
}
