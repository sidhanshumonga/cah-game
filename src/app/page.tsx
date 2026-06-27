"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { Logo, Btn, Avatar, Coin, PromptCard, AnswerCard } from '@/components/components';

const DEMO_POOL = [
  { prompt: "My secret talent is ____.", answer: "Making every situation slightly worse." },
  { prompt: "The reason I got banned from Thanksgiving dinner was ____.", answer: "An aggressively honest PowerPoint presentation." },
  { prompt: "My therapist told me to stop blaming ____ for all my problems.", answer: "The consequences of my own actions." },
  { prompt: "Nothing kills the mood faster than ____.", answer: "Accidentally calling them \"bro.\"" },
  { prompt: "My dating profile can best be described as ____.", answer: "A collection of red flags with good lighting." },
  { prompt: "The worst thing to hear during a job interview is ____.", answer: "Can you explain this tweet?" },
  { prompt: "My retirement plan currently depends on ____.", answer: "Going viral for the wrong reason." },
  { prompt: "The real reason my last relationship ended was ____.", answer: "Competitive overthinking." },
  { prompt: "I thought adulthood would involve more success and less ____.", answer: "Pretending to know what I'm doing." },
  { prompt: "The secret ingredient in every bad decision is ____.", answer: "Free tequila." }
];

function SampleDeck() {
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1); // 1 = forward, -1 = backward
  const [paused, setPaused] = useState(false);
  
  // Set default slice for SSR / initial render consistency
  const [deckPairs, setDeckPairs] = useState(() => DEMO_POOL.slice(0, 6));
  const [deckCards, setDeckCards] = useState(() => {
    const flat: any[] = [];
    DEMO_POOL.slice(0, 6).forEach(pair => {
      flat.push({ type: 'prompt', text: pair.prompt });
      flat.push({ type: 'answer', text: pair.answer });
    });
    return flat;
  });

  useEffect(() => {
    // Select 6 random cards on client-side mount
    const shuffled = [...DEMO_POOL].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 6);
    setDeckPairs(selected);
    
    const flat: any[] = [];
    selected.forEach(pair => {
      flat.push({ type: 'prompt', text: pair.prompt });
      flat.push({ type: 'answer', text: pair.answer });
    });
    setDeckCards(flat);
  }, []);

  useEffect(() => {
    if (paused || !deckCards.length) return;
    const t = setInterval(() => {
      setI((prev) => {
        const next = prev + dir;
        if (next >= deckCards.length) {
          setDir(-1);
          return prev - 1;
        } else if (next < 0) {
          setDir(1);
          return prev + 1;
        }
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [paused, dir, deckCards.length]);

  const handleCardClick = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setI(idx);
    if (idx === deckCards.length - 1) {
      setDir(-1);
    } else if (idx === 0) {
      setDir(1);
    }
  };

  const pairIndex = Math.floor(i / 2) % (deckPairs.length || 1);
  const pair = deckPairs[pairIndex] || deckPairs[0];

  return (
    <div
      className="sample-deck-container"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Desktop view: Static pair */}
      <div 
        className="sample-deck" 
        onClick={() => setI((prev) => (prev + 2) % (deckCards.length || 1))}
        title="Click for another"
      >
        <span className="sample-kicker">A taste of the deck</span>
        {pair && (
          <div className="sample-cards">
            <PromptCard key={"p" + pairIndex} text={pair.prompt} small={true} className="sample-prompt" />
            <span className="sample-plus" aria-hidden="true">+</span>
            <AnswerCard key={"a" + pairIndex} text={pair.answer} small={true} className="sample-answer" />
          </div>
        )}
        <div className="sample-dots" aria-hidden="true">
          {deckPairs.map((_, k) => (
            <span 
              key={k} 
              className={"sample-dot" + (k === pairIndex ? " sample-dot-on" : "")}
              onClick={(e) => { e.stopPropagation(); setI(k * 2); }}
            ></span>
          ))}
        </div>
      </div>

      {/* Mobile view: Carousel */}
      <div className="sample-deck-carousel">
        <span className="sample-kicker">A taste of the deck</span>
        <div className="sample-carousel-viewport">
          <div 
            className="sample-carousel-track"
            style={{ "--active-index": i } as React.CSSProperties}
          >
            {deckCards.map((card, idx) => {
              const isCenter = idx === i;
              const classes = "carousel-card-wrapper" + (isCenter ? " center" : " side");
              
              return (
                <div 
                  key={idx} 
                  className={classes}
                  onClick={(e) => handleCardClick(idx, e)}
                >
                  {card.type === 'prompt' ? (
                    <PromptCard text={card.text} small={true} />
                  ) : (
                    <AnswerCard text={card.text} small={true} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="sample-dots" aria-hidden="true">
          {deckCards.map((_, k) => (
            <span 
              key={k} 
              className={"sample-dot" + (k === i ? " sample-dot-on" : "")}
              onClick={(e) => handleCardClick(k, e)}
            ></span>
          ))}
        </div>
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
        const myUid = account ? (account.uid || account.email) : undefined;
        const res = await verifyRoom(code, myUid);
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
        <div className="landing-nav">
          <button className="nav-link" onClick={() => router.push('/howto')}>Rules</button>
          <button className="nav-link" onClick={() => router.push('/feedback')}>Feedback</button>
        </div>
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
        
        {/* Howto play guide moved to top navigation */}

        <CrossPromo />

        <footer className="landing-footer">
          <p className="footer-warning">
            Disclaimer: Cards Against Humanity is a mature party game containing suggestive themes, dark humor, and adult language. Player discretion is strongly advised. 18+ only.
          </p>
          <p className="footer-warning" style={{ marginTop: '8px', opacity: 0.5, fontSize: '11px' }}>
            This is an unofficial, independent fan-made party game. "Cards Against Humanity" is a registered trademark of Cards Against Humanity LLC. This web application is not affiliated with, authorized, sponsored, or endorsed by Cards Against Humanity LLC. All card texts and brand trademarks are the property of their respective owners.
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
