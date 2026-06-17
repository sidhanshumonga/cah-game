"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext, getUserRegion, RegionInfo } from '@/context/GameContext';
import { Logo, Coin } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';

export default function CoinsPage() {
  const router = useRouter();
  const { account, isHydrated } = useGameContext();
  const [loadingBundle, setLoadingBundle] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [userRegion, setUserRegion] = useState<RegionInfo>({
    country: 'US',
    currency: 'usd',
    symbol: '$',
    bundles: [
      { coins: 500, tag: "$4.99", productId: "prod_UiU1bLVVTs3WEp" },
      { coins: 1200, tag: "$9.99", productId: "prod_UiU1NqbXoVoF78", best: true },
      { coins: 3000, tag: "$19.99", productId: "prod_UiU2mxisRKNBys" }
    ]
  });

  useEffect(() => {
    setUserRegion(getUserRegion());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('success') === 'true') {
        setNotification("Success! Your payment was processed. Your coins will reflect in your account shortly.");
        router.replace('/coins');
      } else if (params.get('canceled') === 'true') {
        setNotification("Checkout canceled. No charges were made.");
        router.replace('/coins');
      }
    }
  }, [router]);

  const handleBack = () => {
    router.push('/store');
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const handleCheckout = async (b: any) => {
    if (!account) {
      handleLogin();
      return;
    }
    setLoadingBundle(b.coins);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: b.productId,
          coins: b.coins,
          uid: account.uid,
          email: account.email || '',
          currency: userRegion.currency,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.replace(data.url);
      } else {
        alert("Failed to initiate Stripe Checkout: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred initiating checkout. Please try again.");
    } finally {
      setLoadingBundle(null);
    }
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
        {notification ? (
          <div className="alert-banner" style={{
            background: 'var(--accent)',
            color: 'var(--paper)',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 700,
            marginBottom: '20px',
            textAlign: 'center',
            fontFamily: 'var(--font-d)'
          }}>
            {notification}
          </div>
        ) : null}
        <p className="store-earn-note">Top up your coin balance to unlock upgrades and expansion packs in the marketplace:</p>
        <div className="store-grid store-grid-wide">
          {userRegion.bundles.map((b) => (
            <div key={b.coins} className={"store-card bundle" + (b.best ? " bundle-best" : "")}>
              {b.best ? <span className="bundle-flag">Best value</span> : null}
              <span className="store-card-name"><Coin size={18} /> {b.coins.toLocaleString()}</span>
              <span className="store-card-sub">coins</span>
              <button 
                className="buybtn" 
                disabled={loadingBundle !== null}
                onClick={() => handleCheckout(b)}
              >
                {loadingBundle === b.coins ? "Redirecting..." : b.tag}
              </button>
            </div>
          ))}
        </div>
        <p className="coins-note">Coins are spent in the Marketplace on packs and upgrades. Payments are processed securely via Stripe.</p>
      </div>
    </div>
  );
}
