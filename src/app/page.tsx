"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { Logo, Btn, Avatar, Coin, PromptCard, AnswerCard } from '@/components/components';

const SAMPLE_PAIRS = [
  { prompt: "My secret talent is ____.", answer: "aggressive interpretive dance" },
  { prompt: "The real reason I was late today: ____.", answer: "a haunted Roomba" },
  { prompt: "New from IKEA: the ____.", answer: "decorative gourds" },
  { prompt: "My villain origin story began with ____.", answer: "a group project" },
  { prompt: "Rejected ice cream flavor: ____.", answer: "lukewarm soup" },
  { prompt: "What's that smell? Oh, it's ____.", answer: "my browser history" }
];

function SampleDeck() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % SAMPLE_PAIRS.length), 3400);
    return () => clearInterval(t);
  }, [paused]);
  const pair = SAMPLE_PAIRS[i];
  function advance() { setI((n) => (n + 1) % SAMPLE_PAIRS.length); }
  return (
    <div
      className="sample-deck"
      onClick={advance}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      title="Click for another"
    >
      <span className="sample-kicker">A taste of the deck</span>
      <div className="sample-cards">
        <PromptCard key={"p" + i} text={pair.prompt} small={true} className="sample-prompt" />
        <span className="sample-plus" aria-hidden="true">+</span>
        <AnswerCard key={"a" + i} text={pair.answer} small={true} className="sample-answer" />
      </div>
      <div className="sample-dots" aria-hidden="true">
        {SAMPLE_PAIRS.map((_, k) => (
          <span key={k} className={"sample-dot" + (k === i ? " sample-dot-on" : "")}></span>
        ))}
      </div>
    </div>
  );
}

const OTHER_GAME = {
  name: "Hot Seat",
  pitch: "The party game where your friends answer for you. Awkward, guaranteed.",
  url: "https://your-other-game.example.com"
};

function CrossPromo() {
  return null; // Hidden for now
  /*
  return (
    <a className="crosspromo" href={OTHER_GAME.url} target="_blank" rel="noopener noreferrer">
      <span className="crosspromo-badge">New</span>
      <span className="crosspromo-clip" aria-hidden="true"><span className="crosspromo-shine"></span></span>
      <span className="crosspromo-body">
        <span className="crosspromo-kicker">Also from our table</span>
        <span className="crosspromo-name">{OTHER_GAME.name}</span>
        <span className="crosspromo-pitch">{OTHER_GAME.pitch}</span>
      </span>
      <span className="crosspromo-go">Play<span className="crosspromo-arrow">→</span></span>
    </a>
  );
  */
}

export default function LandingPage() {
  const router = useRouter();
  const { account, setMode, setGameKey } = useGameContext();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const decor = [
    { text: "an emotional support raccoon", x: "6%", y: "14%", r: -12, d: 0 },
    { text: "My secret talent is ____.", x: "78%", y: "10%", r: 9, d: 1.2, dark: true },
    { text: "one single crouton", x: "84%", y: "62%", r: -7, d: 0.6 },
    { text: "a haunted Roomba", x: "4%", y: "66%", r: 8, d: 1.8 },
    { text: "Rejected ice cream flavor: ____.", x: "14%", y: "40%", r: -4, d: 2.4, dark: true },
    { text: "seventeen alarms, all snoozed", x: "72%", y: "36%", r: 5, d: 3 }
  ];

  const handleJoin = async () => {
    if (code.length === 4) {
      setLoading(true);
      setErrorMsg("");
      try {
        const { verifyRoom } = await import('@/firebase/firestore');
        const res = await verifyRoom(code);
        if (!res.valid) {
          if (res.error === 'not_found') {
            setErrorMsg("Room not found. Check the code.");
          } else if (res.error === 'in_progress') {
            setErrorMsg("Game already in progress.");
          } else if (res.error === 'ended') {
            setErrorMsg("Game has ended.");
          } else if (res.error === 'full') {
            setErrorMsg("Room is full.");
          } else {
            setErrorMsg("Unable to join this room.");
          }
          setLoading(false);
          return;
        }
        setMode("join");
        setGameKey((k) => k + 1);
        router.push(`/lobby/${code}`);
      } catch (e) {
        console.error("Verification failed", e);
        setErrorMsg("Error verifying room. Try again.");
        setLoading(false);
      }
    }
  };

  const handleCreate = () => {
    router.push('/create');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const handleProfile = () => {
    router.push('/profile');
  };

  return (
    <div className="screen landing" data-screen-label="Landing">
      <div className="landing-top">
        {account ? (
          <button className="userchip" onClick={handleProfile}>
            <Avatar player={account} size={26} />
            <span className="userchip-name">{account.name}</span>
            <span className="userchip-coins"><Coin size={13} /> {account.credits.toLocaleString()}</span>
          </button>
        ) : (
          <Btn variant="secondary" onClick={handleLogin}>Log in</Btn>
        )}
      </div>
      
      <div className="bgcards" aria-hidden="true">
        {decor.map((c, i) => (
          <div
            key={i}
            className={"bgcard" + (c.dark ? " bgcard-dark" : "")}
            style={{ left: c.x, top: c.y, "--r": c.r + "deg", animationDelay: c.d + "s" } as React.CSSProperties}
          >
            {c.text}
          </div>
        ))}
      </div>

      <div className="hero">
        <h1 className="hero-logo"><Logo big={true} /></h1>
        <p className="tagline">{"The fill\u2011in\u2011the\u2011blank party game for people with questionable friends."}</p>
        <SampleDeck />
        
        {!joining ? (
          <div className="landing-actions">
            <Btn big={true} onClick={handleCreate}>Create a room</Btn>
            <Btn big={true} variant="secondary" onClick={() => setJoining(true)}>Join a room</Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="landing-actions joinrow">
              <input
                className="input input-code"
                maxLength={4}
                placeholder="CODE"
                value={code}
                autoFocus={true}
                disabled={loading}
                onChange={(e) => {
                  setErrorMsg("");
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""));
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleJoin(); }}
              />
              <Btn big={true} disabled={code.length !== 4 || loading} onClick={handleJoin}>
                {loading ? "Checking..." : "Join"}
              </Btn>
              <Btn big={true} variant="ghost" disabled={loading} onClick={() => { setJoining(false); setErrorMsg(""); }}>Back</Btn>
            </div>
            {errorMsg && (
              <div style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: 500, background: 'rgba(255,77,79,0.1)', padding: '6px 12px', borderRadius: '6px' }}>
                ✕ {errorMsg}
              </div>
            )}
          </div>
        )}

        <ul className="feature-row">
          <li>Play with friends online</li>
          <li>No downloads, nothing to install</li>
          <li>Phones, laptops, whatever</li>
        </ul>
        
        <button className="howto-link" onClick={() => router.push('/howto')}>
          <span className="howto-link-q">?</span> New here? How to play
        </button>

        <CrossPromo />

        <footer className="landing-footer">
          <p className="footer-warning">
            Disclaimer: Cards Against Humanity is a mature party game containing suggestive themes, dark humor, and adult language. Player discretion is strongly advised. 18+ only.
          </p>
          <div className="footer-links">
            <button className="linkbtn" onClick={() => router.push('/terms')}>Terms of Service</button>
            <span>·</span>
            <button className="linkbtn" onClick={() => router.push('/privacy')}>Privacy Policy</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
