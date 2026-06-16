"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { GAME_DATA } from '../data/game-data';
import { Player } from '@/context/GameContext';

export const CONFETTI_COLORS = ["#FF5C39", "#FFC93C", "#7C5CFF", "#2BC4BE", "#FF4D8D", "#5CA9FF"];

/* ---------- Logo ---------- */
interface LogoProps {
  big?: boolean;
  disabled?: boolean;
}

export function Logo({ big, disabled }: LogoProps) {
  const inner = (
    <React.Fragment>
      cards against{big ? <br /> : " "}<span className="logo-card">humanity</span>
    </React.Fragment>
  );
  const cls = "logo" + (big ? " logo-big" : "");
  const style = { textDecoration: 'none', color: 'inherit' };
  
  if (disabled) {
    return (
      <span className={cls} style={{ ...style, cursor: 'default' }}>
        {inner}
      </span>
    );
  }
  return (
    <Link href="/" className={cls} style={style}>
      {inner}
    </Link>
  );
}

/* ---------- Button ---------- */
interface BtnProps {
  variant?: "primary" | "secondary" | "ghost" | "accent";
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  big?: boolean;
}

export function Btn({ variant, children, onClick, disabled, className, big }: BtnProps) {
  return (
    <button
      className={
        "btn " + (variant || "primary") + (big ? " btn-big" : "") + (className ? " " + className : "")
      }
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/* ---------- Coin ---------- */
export function Coin({ size }: { size?: number }) {
  const s = size || 14;
  return (
    <svg className="coin" width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="var(--accent2)"></circle>
      <circle cx="10" cy="10" r="6" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.6"></circle>
      <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.4"></circle>
    </svg>
  );
}

export function LockIcon({ size }: { size?: number }) {
  const s = size || 12;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17 10V7a5 5 0 0 0-10 0v3H5v12h14V10h-2zm-8-3a3 3 0 0 1 6 0v3H9V7z"></path>
    </svg>
  );
}

/* ---------- Avatar ---------- */
export function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.6 10H4.6L3 8z"></path>
    </svg>
  );
}

interface AvatarProps {
  player: { name: string; color: string };
  size?: number;
  judge?: boolean;
  done?: boolean;
  dim?: boolean;
}

export function Avatar({ player, size, judge, done, dim }: AvatarProps) {
  const s = size || 40;
  return (
    <span
      className={"avatar" + (dim ? " avatar-dim" : "")}
      style={{ width: s, height: s, background: player.color, fontSize: s * 0.42 }}
      title={player.name}
    >
      {player.name ? player.name[0] : '?'}
      {judge ? (
        <span className="avatar-badge avatar-crown"><CrownIcon /></span>
      ) : null}
      {done ? <span className="avatar-badge avatar-check">✓</span> : null}
    </span>
  );
}

/* ---------- Prompt text with styled blanks ---------- */
export function PromptText({ text, fill }: { text: string; fill?: string }) {
  const parts = text.split("____");
  return (
    <React.Fragment>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {p}
          {i < parts.length - 1 ? (
            fill ? <span className="blank-fill">{fill}</span> : <span className="blank"></span>
          ) : null}
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

interface PromptCardProps {
  text: string;
  fill?: string;
  small?: boolean;
  className?: string;
}

export function PromptCard({ text, fill, small, className }: PromptCardProps) {
  return (
    <div className={"pcard" + (small ? " pcard-small" : "") + (className ? " " + className : "")}>
      <div className="pcard-text"><PromptText text={text} fill={fill} /></div>
      <div className="card-foot"><Logo /></div>
    </div>
  );
}

/* ---------- Answer card (face up) ---------- */
interface AnswerCardProps {
  text: string;
  selected?: boolean;
  dimmed?: boolean;
  winner?: boolean;
  small?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function AnswerCard({ text, selected, dimmed, winner, small, onClick, className, style }: AnswerCardProps) {
  const cls =
    "acard" +
    (selected ? " acard-selected" : "") +
    (dimmed ? " acard-dimmed" : "") +
    (winner ? " acard-winner" : "") +
    (small ? " acard-small" : "") +
    (className ? " " + className : "");
  if (onClick) {
    return (
      <button className={cls} style={style} onClick={onClick}>
        <span className="acard-text">{text}</span>
        <span className="card-foot card-foot-light"><Logo /></span>
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      <span className="acard-text">{text}</span>
      <span className="card-foot card-foot-light"><Logo /></span>
    </div>
  );
}

/* ---------- Flip card (face-down -> face-up) for judging ---------- */
interface FlipCardProps {
  text: string;
  flipped: boolean;
  winner?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  delay?: string;
  clickable?: boolean;
}

export function FlipCard({ text, flipped, winner, dimmed, onClick, delay, clickable }: FlipCardProps) {
  const inner = (
    <span className="flip-inner" style={{ transitionDelay: flipped && delay ? delay : "0s" }}>
      <span className="flip-face flip-back">
        <span className="flip-mark">cah<span className="flip-dot">.</span></span>
      </span>
      <span className="flip-face flip-front">
        <span className="acard-text">{text}</span>
      </span>
    </span>
  );
  const cls =
    "flipwrap" +
    (flipped ? " is-flipped" : "") +
    (winner ? " flip-winner" : "") +
    (dimmed ? " flip-dimmed" : "");
  if (clickable) {
    return <button className={cls} onClick={onClick}>{inner}</button>;
  }
  return <div className={cls}>{inner}</div>;
}

/* ---------- Confetti ---------- */
export function ConfettiBurst({ count }: { count?: number }) {
  const pieces = useMemo(() => {
    const n = Math.max(0, count == null ? 120 : count);
    return Array.from({ length: n }, (_, i) => ({
      x: Math.random() * 100,
      dur: 1.4 + Math.random() * 1.8,
      delay: Math.random() * 0.5,
      rot: 200 + Math.random() * 520,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 8,
      drift: -60 + Math.random() * 120,
      round: Math.random() > 0.7
    }));
  }, [count]);
  if (!pieces.length) return null;
  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: p.x + "%",
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            borderRadius: p.round ? "50%" : "1px",
            background: p.color,
            animationDuration: p.dur + "s",
            animationDelay: p.delay + "s",
            // @ts-ignore
            "--rot": p.rot + "deg",
            "--drift": p.drift + "px"
          }}
        ></span>
      ))}
    </div>
  );
}

/* ---------- Floating emoji reactions ---------- */
export function spawnReaction(emoji: string, x?: number, name?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent("spawn-reaction", { detail: { emoji: emoji, x: x, name: name } })
    );
  }
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  drift: number;
  name?: string;
}

export function ReactionLayer() {
  const [items, setItems] = useState<FloatingReaction[]>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      const id = Math.random().toString(36).slice(2);
      const item: FloatingReaction = {
        id: id,
        emoji: customEvent.detail.emoji,
        x: customEvent.detail.x != null ? customEvent.detail.x : 12 + Math.random() * 76,
        drift: -30 + Math.random() * 60,
        name: customEvent.detail.name
      };
      setItems((s) => [...s, item]);
      setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 2600);
    };
    window.addEventListener("spawn-reaction", handler);
    return () => window.removeEventListener("spawn-reaction", handler);
  }, []);
  return (
    <div className="reaction-layer" aria-hidden="true">
      {items.map((i) => (
        <span
          key={i.id}
          className="float-emoji"
          // @ts-ignore
          style={{ left: i.x + "%", "--drift": i.drift + "px", display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        >
          <span>{i.emoji}</span>
          {i.name && (
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#ffffff',
              background: 'rgba(0,0,0,0.65)',
              padding: '2px 6px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              fontFamily: 'var(--font-b)'
            }}>
              {i.name}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function ReactionBar({ onReact }: { onReact?: (emoji: string) => void }) {
  return (
    <div className="reaction-bar">
      {GAME_DATA.reactions.map((r) => (
        <button key={r} className="reaction-btn" onClick={() => {
          if (onReact) {
            onReact(r);
          } else {
            spawnReaction(r);
          }
        }}>
          {r}
        </button>
      ))}
    </div>
  );
}

/* ---------- Timer bar ---------- */
export function TimerBar({ seconds, total }: { seconds: number; total: number }) {
  const pct = Math.max(0, (seconds / total) * 100);
  return (
    <div className={"timerbar" + (seconds <= 10 ? " timerbar-low" : "")}>
      <div className="timerbar-fill" style={{ width: pct + "%" }}></div>
      <span className="timerbar-num">{seconds}s</span>
    </div>
  );
}

/* ---------- Top bar ---------- */
interface TopBarProps {
  code: string;
  round?: number;
  players: Player[];
  judge?: Player;
  you: Player;
  limit: number;
  onScores: () => void;
  onChatToggle?: () => void;
  unreadCount?: number;
  isHost?: boolean;
  onLeave?: () => void;
  onEndGame?: () => void;
}

export function TopBar({ code, round, judge, you, limit, onScores, onChatToggle, unreadCount, isHost, onLeave, onEndGame }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo-wrap"><Logo disabled={true} /></div>
        <span className="chip chip-code">{code}</span>
      </div>
      <div className="topbar-mid">
        {round ? <span className="topbar-round">Round {round}</span> : null}
        {judge ? (
          <span className="topbar-judge">
            <Avatar player={judge} size={22} />
            <span className="topbar-judge-text">{judge.isYou ? "You are" : judge.name + " is"} judging</span>
          </span>
        ) : null}
      </div>
      <div className="topbar-right">
        {onChatToggle && (
          <button className="chip topbar-chat-btn" onClick={onChatToggle} style={{ position: 'relative' }}>
            💬 <span className="topbar-btn-txt">Chat</span>
            {unreadCount ? (
              <span style={{ background: '#ff4d4f', color: '#fff', fontSize: '10px', padding: '1px 5px', borderRadius: '10px', fontWeight: 'bold', marginLeft: '4px' }}>
                {unreadCount}
              </span>
            ) : null}
          </button>
        )}
        <button className="chip chip-score" onClick={onScores}>
          <span className="chip-score-dot" style={{ background: you.color }}></span>
          <span className="topbar-score-txt">{you.score} / {limit} pts</span>
          <span className="topbar-score-compact">{you.score}/{limit}</span>
        </button>
        {isHost ? (
          onEndGame && (
            <button className="chip topbar-action-btn topbar-end-btn" onClick={onEndGame} style={{ background: '#ff4d4f', color: '#fff', border: '0', fontWeight: 'bold', cursor: 'pointer' }}>
              <span className="topbar-btn-txt">🛑 End Game</span>
              <span className="topbar-btn-icon">🛑</span>
            </button>
          )
        ) : (
          onLeave && (
            <button className="chip topbar-action-btn topbar-leave-btn" onClick={onLeave} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '0', cursor: 'pointer' }}>
              <span className="topbar-btn-txt">🚪 Leave</span>
              <span className="topbar-btn-icon">🚪</span>
            </button>
          )
        )}
      </div>
    </header>
  );
}

/* ---------- Persistent in-game score rail ---------- */
export function SideScores({ players, judgeId, limit }: { players: Player[]; judgeId: string; limit: number }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top = sorted[0] ? sorted[0].score : 0;
  return (
    <aside className="sidescores">
      <span className="ss-title">Scores</span>
      {sorted.map((p) => {
        const isOffline = p.isConnected === false;
        const isLeft = !!p.left;
        const statusText = isLeft ? " (left)" : isOffline ? " (offline)" : "";
        const dim = isLeft || isOffline;
        return (
          <div key={p.id} className={"ss-row" + (p.isYou ? " ss-you" : "")} style={{ opacity: dim ? 0.55 : 1 }}>
            <Avatar player={p} size={28} judge={p.id === judgeId} dim={dim} />
            <span className="ss-name" title={p.name + statusText}>
              {p.name}{p.isYou ? " (you)" : ""}{statusText}
            </span>
            <span key={p.score} className={"ss-pts" + (p.score === top && top > 0 ? " ss-lead" : "")}>{p.score}</span>
          </div>
        );
      })}
      <span className="ss-goal">first to {limit} wins</span>
    </aside>
  );
}

/* ---------- Scoreboard slide-over ---------- */
interface ScorePanelProps {
  open: boolean;
  onClose: () => void;
  players: Player[];
  limit: number;
}

export function ScorePanel({ open, onClose, players, limit }: ScorePanelProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <React.Fragment>
      <div className={"scrim" + (open ? " scrim-open" : "")} onClick={onClose}></div>
      <aside className={"scorepanel" + (open ? " scorepanel-open" : "")}>
        <div className="scorepanel-head">
          <h3>Leaderboard</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="scorepanel-sub">First to {limit} points wins</p>
        <ul className="scorelist">
          {sorted.map((p, i) => {
            const isOffline = p.isConnected === false;
            const isLeft = !!p.left;
            const statusText = isLeft ? " (left)" : isOffline ? " (offline)" : "";
            const dim = isLeft || isOffline;
            return (
              <li key={p.id} className="scorerow" style={{ opacity: dim ? 0.55 : 1 }}>
                <span className="scorerow-rank">{i + 1}</span>
                <Avatar player={p} size={34} dim={dim} />
                <span className="scorerow-name" title={p.name + statusText}>
                  {p.name}{p.isYou ? " (you)" : ""}{statusText}
                </span>
                <span className="scorerow-bar">
                  <span
                    className="scorerow-fill"
                    style={{ width: Math.min(100, (p.score / limit) * 100) + "%", background: p.color }}
                  ></span>
                </span>
                <span className="scorerow-pts">{p.score}</span>
              </li>
            );
          })}
        </ul>
      </aside>
    </React.Fragment>
  );
}
