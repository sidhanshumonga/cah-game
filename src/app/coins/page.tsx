"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { Logo, Coin } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';

export default function CoinsPage() {
  const router = useRouter();
  const { account, buyCredits, isHydrated } = useGameContext();

  const handleBack = () => {
    router.back();
  };

  const handleLogin = () => {
    router.push('/login');
  };

  if (!isHydrated) {
    return (
      <div className="screen center-screen">
        <div className="waiting-text">Loading shop...</div>
      </div>
    );
  }

  return (
    <div className="screen create-screen" data-screen-label="Coins">
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
      <div className="create-body coins-body">
        <h2 className="create-title">Coins</h2>
        <p className="store-earn-note">Top up your coin balance to unlock upgrades and expansion packs in the marketplace:</p>
        <div className="store-grid store-grid-wide">
          {GAME_DATA.creditBundles.map((b) => (
            <div key={b.coins} className={"store-card bundle" + (b.best ? " bundle-best" : "")}>
              {b.best ? <span className="bundle-flag">Best value</span> : null}
              <span className="store-card-name"><Coin size={18} /> {b.coins.toLocaleString()}</span>
              <span className="store-card-sub">coins</span>
              <button className="buybtn" onClick={() => (account ? buyCredits(b) : handleLogin())}>{b.tag}</button>
            </div>
          ))}
        </div>
        <p className="coins-note">Coins are spent in the Marketplace on packs and upgrades. Purchases here are simulated — no real money involved.</p>
      </div>
    </div>
  );
}
