"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext, getUserRegion, RegionInfo } from '@/context/GameContext';
import { Logo, Btn, Coin } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';
import { auth, isFirebaseEnabled } from '@/firebase/config';
import { ChevronLeft } from 'lucide-react';

export default function CoinsPage() {
  const router = useRouter();
  const { account, isHydrated } = useGameContext();
  const [loadingBundle, setLoadingBundle] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [showGoogleLoginPrompt, setShowGoogleLoginPrompt] = useState(false);

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
    router.back();
  };

  const handleLogin = () => {
    router.push('/login');
  };

  const handleCheckout = async (b: any) => {
    if (!account) {
      handleLogin();
      return;
    }
    if (!account.uid) {
      setShowGoogleLoginPrompt(true);
      return;
    }
    setLoadingBundle(b.coins);
    try {
      const idToken = isFirebaseEnabled && auth?.currentUser ? await auth.currentUser.getIdToken() : '';
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          productId: b.productId,
          coins: b.coins,
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
        <button className="iconbtn create-back" onClick={handleBack} aria-label="Back">
          <ChevronLeft size={20} />
        </button>
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

      {showGoogleLoginPrompt && (
        <React.Fragment>
          <div className="scrim scrim-open" style={{ zIndex: 110 }} onClick={() => setShowGoogleLoginPrompt(false)}></div>
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
            width: '420px',
            maxWidth: '92vw',
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            textAlign: 'center'
          }}>
            <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '20px', fontWeight: 800, margin: 0 }}>Google Login Required</h3>
            <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: 1.5, margin: 0 }}>
              To purchase coins and sync your marketplace upgrades, you must be logged in with a Google account.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <Btn onClick={() => router.push('/login?redirectTo=/coins')}>Log in with Google</Btn>
              <Btn variant="secondary" onClick={() => setShowGoogleLoginPrompt(false)}>Cancel</Btn>
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}
