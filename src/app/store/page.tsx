"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext, ownsPack, sortPacks, isUserIndian } from '@/context/GameContext';
import { Logo, Coin, LockIcon } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';

const STORE_SECTIONS = [
  { id: "packs", label: "Card packs" },
  { id: "upgrades", label: "Upgrades" }
];

export default function StorePage() {
  const router = useRouter();
  const { account, buyPack, buyUpgrade, isHydrated, isPacksLoaded, packs } = useGameContext();

  const sortedPacks = React.useMemo(() => {
    return sortPacks(packs, account, isUserIndian());
  }, [packs, account]);
  const [activeSection, setActiveSection] = useState("packs");
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const canAfford = (price: number) => {
    return account ? account.credits >= price : false;
  };

  const goSection = (id: string) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 86;
    window.scrollTo({ top: y, behavior: "smooth" });
    setActiveSection(id);
  };

  useEffect(() => {
    const onScroll = () => {
      let cur = "packs";
      STORE_SECTIONS.forEach((s) => {
        const el = sectionRefs.current[s.id];
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) {
          cur = s.id;
        }
      });
      setActiveSection(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const handleCoins = () => {
    router.push('/coins');
  };

  const ownedCount = packs.filter((p) => ownsPack(account, p)).length;
  
  const counts = {
    packs: ownedCount + " / " + packs.length,
    upgrades: (account ? account.upgrades.length : 0) + " / " + GAME_DATA.upgrades.length
  };

  if (!isHydrated || !isPacksLoaded) {
    return (
      <div className="screen center-screen">
        <div className="waiting-text">Loading store...</div>
      </div>
    );
  }

  return (
    <div className="screen create-screen" data-screen-label="Marketplace">
      <header className="create-head store-head">
        <button className="iconbtn create-back" onClick={handleBack} aria-label="Back">←</button>
        <Logo />
        <span className="store-balance">
          {account ? (
            <React.Fragment><Coin size={18} /> {account.credits.toLocaleString()}</React.Fragment>
          ) : (
            <button className="linkbtn" onClick={handleLogin}>Log in to buy</button>
          )}
        </span>
      </header>

      <div className="create-body store-layout">
        <h2 className="create-title store-title">Marketplace</h2>
        <nav className="store-nav">
          {STORE_SECTIONS.map((s) => (
            <button
              key={s.id}
              className={"store-nav-btn" + (activeSection === s.id ? " store-nav-on" : "")}
              onClick={() => goSection(s.id)}
            >
              {s.label}
              <span className="store-nav-count">{counts[s.id as keyof typeof counts]}</span>
            </button>
          ))}
          <div className="store-nav-split"></div>
          <button className="store-nav-btn store-nav-coins" onClick={handleCoins}>
            <span className="store-nav-coinlabel"><Coin size={13} /> Get coins</span>
            <span className="store-nav-count">→</span>
          </button>
        </nav>

        <div className="store-content">
          <section ref={(el) => { sectionRefs.current.packs = el; }}>
            <h3 className="store-sec store-sec-first">Card packs</h3>
            <div className="store-grid">
              {sortedPacks.map((p) => {
                const owned = ownsPack(account, p);
                return (
                  <div key={p.id} className={"store-card" + (owned ? " store-owned" : "")}>
                    <span className="store-card-name">{p.name}</span>
                    <span className="store-card-sub">{p.cards} cards</span>
                    {p.free ? (
                      <span className="store-tag">Included free</span>
                    ) : owned ? (
                      <span className="store-tag store-tag-owned">✓ Owned</span>
                    ) : (
                      <button
                        className="buybtn"
                        disabled={!account || !canAfford(p.price || 0)}
                        onClick={() => (account ? buyPack({ id: p.id, name: p.name, price: p.price || 0 }) : handleLogin())}
                      >
                        <Coin size={13} /> {p.price}
                        {account && !canAfford(p.price || 0) ? <span className="buybtn-no">not enough</span> : null}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section ref={(el) => { sectionRefs.current.upgrades = el; }}>
            <h3 className="store-sec">Upgrades</h3>
            <div className="store-grid store-grid-wide">
              {GAME_DATA.upgrades.map((u) => {
                const owned = account && account.upgrades.includes(u.id);
                return (
                  <div key={u.id} className={"store-card" + (owned ? " store-owned" : "")}>
                    <span className="store-card-name">{u.name}</span>
                    <span className="store-card-sub">{u.desc}</span>
                    {u.id === 'customCards' ? (
                      <span className="store-tag" style={{ opacity: 0.6 }}>Coming soon</span>
                    ) : owned ? (
                      <span className="store-tag store-tag-owned">✓ Owned</span>
                    ) : (
                      <button
                        className="buybtn"
                        disabled={!account || !canAfford(u.price)}
                        onClick={() => (account ? buyUpgrade(u) : handleLogin())}
                      >
                        <Coin size={13} /> {u.price}
                        {account && !canAfford(u.price) ? <span className="buybtn-no">not enough</span> : null}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="store-earn-note">Running low? <button className="linkbtn" onClick={handleCoins}>Get more coins →</button></p>
          </section>
        </div>
      </div>
    </div>
  );
}
