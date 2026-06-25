"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext, ownsPack, sortPacks, isUserIndian, Pack } from '@/context/GameContext';
import { Logo, Coin, LockIcon, Btn } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';
import { Eye } from 'lucide-react';

const STORE_SECTIONS = [
  { id: "packs", label: "Card packs" },
  { id: "upgrades", label: "Upgrades" }
];

export default function StorePage() {
  const router = useRouter();
  const { account, buyPack, buyUpgrade, isHydrated, isPacksLoaded, packs } = useGameContext();
  const [previewPack, setPreviewPack] = useState<Pack | null>(null);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) {
      setTimeout(() => {
        goSection(tab);
      }, 350);
    }
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
        <h1 className="create-title store-title">Marketplace</h1>
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
                    <button 
                      className="linkbtn" 
                      style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.85, padding: '4px 0', alignSelf: 'flex-start', border: 0, background: 'transparent', cursor: 'pointer', outline: 'none' }}
                      onClick={() => setPreviewPack(p)}
                    >
                      <Eye className="inline-icon" size={13} style={{ color: '#FFC93C' }} /> Preview Cards
                    </button>
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
                    {u.id === 'customCards' || u.id === 'smartBots' || u.id === 'botPersonalities' ? (
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

      {previewPack && (
        <PackPreviewModal pack={previewPack} onClose={() => setPreviewPack(null)} />
      )}
    </div>
  );
}

interface PackPreviewModalProps {
  pack: Pack;
  onClose: () => void;
}

function PackPreviewModal({ pack, onClose }: PackPreviewModalProps) {
  const samplePrompts = pack.prompts ? pack.prompts.slice(0, 3) : [];
  const sampleAnswers = pack.answers ? pack.answers.slice(0, 5) : [];

  return (
    <React.Fragment>
      <div className="scrim scrim-open" style={{ zIndex: 110 }} onClick={onClose}></div>
      <div className="preview-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '22px', fontWeight: 800, margin: 0 }}>{pack.name}</h3>
            <span style={{ fontSize: '13px', opacity: 0.6 }}>Pack Preview ({pack.cards} cards total)</span>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close" style={{ fontSize: '18px' }}>✕</button>
        </div>

        <div className="preview-modal-grid">
          <div>
            <h4 style={{ fontFamily: 'var(--font-d)', fontSize: '15px', fontWeight: 700, margin: '0 0 12px', opacity: 0.9 }}>Prompts (Black Cards)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {samplePrompts.length > 0 ? (
                samplePrompts.map((txt, index) => (
                  <div key={index} style={{
                    background: '#0D0B13',
                    color: '#F2EFE6',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    lineHeight: 1.4,
                    minHeight: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    textAlign: 'left'
                  }}>
                    <span style={{ fontFamily: 'var(--font-d)', fontWeight: 600 }}>{txt}</span>
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', opacity: 0.4, letterSpacing: '0.05em', marginTop: '6px' }}>Point Blank</span>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '13px', opacity: 0.5, margin: 0 }}>No custom prompts in this pack.</p>
              )}
            </div>
          </div>

          <div>
            <h4 style={{ fontFamily: 'var(--font-d)', fontSize: '15px', fontWeight: 700, margin: '0 0 12px', opacity: 0.9 }}>Answers (White Cards)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sampleAnswers.length > 0 ? (
                sampleAnswers.map((txt, index) => (
                  <div key={index} style={{
                    background: '#F8F5EC',
                    color: '#181520',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    lineHeight: 1.3,
                    fontWeight: 600,
                    textAlign: 'left',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}>
                    {txt}
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '13px', opacity: 0.5, margin: 0 }}>No custom answers in this pack.</p>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', marginTop: '6px' }}>
          <Btn variant="secondary" onClick={onClose}>Close Preview</Btn>
        </div>
      </div>
    </React.Fragment>
  );
}
