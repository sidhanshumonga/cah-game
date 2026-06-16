"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext, maxPlayersFor, ownsPack } from '@/context/GameContext';
import { Logo, Coin, LockIcon, Btn } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';

const MAX_PACKS = 8;

function Seg({ options, value, onChange, format }: {
  options: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (o: number) => string;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o}
          className={"seg-btn" + (o === value ? " seg-on" : "")}
          onClick={() => onChange(o)}
        >
          {format ? format(o) : o}
        </button>
      ))}
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={"switch" + (on ? " switch-on" : "")}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    >
      <span className="switch-knob"></span>
    </button>
  );
}

export default function CreateRoomPage() {
  const router = useRouter();
  const { account, setAccount, settings, setSettings, setMode, setGameKey, isHydrated, isPacksLoaded, packs: allPacks } = useGameContext();

  const allowed = maxPlayersFor(account);
  const hasCustom = !!(account && account.upgrades.includes("customCards"));

  const [name, setName] = useState(account ? account.name : settings.name);
  const [maxPlayers, setMaxPlayers] = useState(Math.min(settings.maxPlayers, allowed));
  const [scoreLimit, setScoreLimit] = useState(settings.scoreLimit);
  const [timer, setTimer] = useState(settings.timer);
  const [packs, setPacks] = useState<string[]>(settings.packs);
  const [family, setFamily] = useState(settings.family);
  const [custom, setCustom] = useState(settings.custom && hasCustom);
  const [packQuery, setPackQuery] = useState("");
  const [lockedHint, setLockedHint] = useState<any>(null);
  const [familyNotice, setFamilyNotice] = useState<string | null>(null);

  useEffect(() => {
    if (family) {
      setPacks((prev) => {
        const filtered = prev.filter(id => {
          const p = allPacks.find(pkg => pkg.id === id);
          return !p || p.familyFriendly !== false;
        });
        const diffCount = prev.length - filtered.length;
        if (diffCount > 0) {
          setFamilyNotice(`Note: ${diffCount} mature pack(s) automatically deselected.`);
        }
        return filtered;
      });
    } else {
      setFamilyNotice(null);
    }
  }, [family, allPacks]);

  const atMax = packs.length >= MAX_PACKS;
  const hasNSFWSelected = packs.some((id) => {
    const p = allPacks.find((pkg) => pkg.id === id);
    return p && p.familyFriendly === false;
  });

  const togglePack = (pId: string) => {
    setPacks((s) => {
      if (s.includes(pId)) return s.filter((x) => x !== pId);
      if (s.length >= MAX_PACKS) return s;
      return [...s, pId];
    });
  };

  const randomPacks = () => {
    const owned = allPacks.filter((p) => ownsPack(account, p));
    const shuffled = [...owned].sort(() => Math.random() - 0.5);
    setPacks(shuffled.slice(0, 3).map((p) => p.id));
  };

  const handleBack = () => {
    router.push('/');
  };

  const handleStore = () => {
    router.push('/store');
  };

  const handleCreate = async () => {
    const newSettings = {
      name: name || "Alex",
      maxPlayers,
      scoreLimit,
      timer,
      packs,
      family,
      custom: custom && hasCustom
    };
    setSettings(newSettings);
    setMode("host");
    setGameKey((k) => k + 1);

    // Generate room code
    const letters = "BCDFGHJKLMNPRSTVWZ";
    const generatedCode = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");

    let activeAccount = account;
    if (!activeAccount) {
      const guestName = name.trim() || "Alex";
      const guestEmail = `${guestName.toLowerCase()}-${Math.floor(1000 + Math.random() * 9000)}@guest.example.com`;
      activeAccount = {
        name: guestName,
        email: guestEmail,
        color: "#FF5C39",
        guest: true,
        credits: 50,
        packs: ["classic"],
        upgrades: [],
        history: [],
        wins: 0,
        games: 0,
        createdAt: Date.now(),
      };
      setAccount(activeAccount);
    }

    // Write room to Firestore for real-time multiplayer
    try {
      const { createRoom } = await import('@/firebase/firestore');
      await createRoom(generatedCode, activeAccount.uid || activeAccount.email, activeAccount.name, newSettings);
    } catch (e) {
      console.error("Failed to create Firestore room", e);
    }

    router.push(`/lobby/${generatedCode}`);
  };

  const filteredPacks = allPacks.filter((p) =>
    p.name.toLowerCase().includes(packQuery.trim().toLowerCase())
  );

  if (!isHydrated || !isPacksLoaded) {
    return (
      <div className="screen center-screen">
        <div className="waiting-text">Loading room...</div>
      </div>
    );
  }

  return (
    <div className="screen create-screen" data-screen-label="Create Room">
      <header className="create-head">
        <button className="iconbtn create-back" onClick={handleBack} aria-label="Back">←</button>
        <Logo />
      </header>
      <div className="create-body">
        <h2 className="create-title">Set up your room</h2>
        <div className="create-grid">
          <section className="create-col">
            <h3 className="create-sec">Basics</h3>
            <div className="frow">
              <label className="flabel">Your name</label>
              <input className="input" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="frow">
              <label className="flabel">Max players <span className="flabel-val">{maxPlayers}</span></label>
              <input
                className="range"
                type="range" min="3" max={allowed} step="1" value={maxPlayers}
                onChange={(e) => setMaxPlayers(+e.target.value)}
              />
              {allowed < 20 ? (
                <span className="upsell">
                  <LockIcon size={11} /> Rooms cap at {allowed} players — <button className="linkbtn" onClick={handleStore}>upgrade in the Marketplace</button>
                </span>
              ) : null}
            </div>
            <div className="frow">
              <label className="flabel">Points to win</label>
              <Seg options={[3, 5, 7]} value={scoreLimit} onChange={setScoreLimit} />
            </div>
            <div className="frow">
              <label className="flabel">Turn timer</label>
              <Seg options={[30, 45, 60]} value={timer} onChange={setTimer} format={(o) => o + "s"} />
            </div>
            <div className="frow frow-inline">
              <label className="flabel">Custom cards</label>
              {hasCustom ? (
                <Switch on={custom} onChange={setCustom} />
              ) : (
                <button className="lockpill" onClick={handleStore}><LockIcon size={11} /> Unlock in Marketplace</button>
              )}
            </div>
            <div className="frow frow-inline" style={{ marginBottom: family ? '8px' : '20px' }}>
              <label className="flabel">Family-friendly mode</label>
              <Switch on={family} onChange={setFamily} />
            </div>
            {family ? (
              <p className="packbox-hint" style={{ marginTop: '-12px', marginBottom: '20px', fontSize: '13px', color: 'var(--accent)', opacity: 0.9 }}>
                {familyNotice || "Filters out card packs containing mature themes or adult humor."}
              </p>
            ) : null}
          </section>
          <section className="create-col">
            <h3 className="create-sec">Card packs <span className="flabel-val">{packs.length} selected</span></h3>
            <div className="packbox">
              <div className="packbox-tools">
                <input
                  className="input packsearch"
                  placeholder={"Search " + allPacks.length + " packs\u2026"}
                  value={packQuery}
                  onChange={(e) => setPackQuery(e.target.value)}
                />
                <button className="packtool" onClick={randomPacks}>Surprise me</button>
                <button className="packtool" onClick={() => setPacks([])} disabled={packs.length === 0}>Clear</button>
                <button className="packtool packtool-store" onClick={handleStore}><Coin size={12} /> Marketplace</button>
              </div>
              <div className="packlist">
                {filteredPacks.map((p) => {
                  const owned = ownsPack(account, p);
                  const on = packs.includes(p.id);
                  const adultLocked = family && p.familyFriendly === false;
                  if (!owned || adultLocked) {
                    return (
                      <button
                        key={p.id}
                        className="packchip packchip-locked"
                        onClick={() => setLockedHint(adultLocked ? { ...p, adultLocked: true } : p)}
                      >
                        <LockIcon size={11} /> {p.name}
                        {adultLocked ? (
                          <span className="packchip-price" style={{ color: 'var(--red)' }}>adult content</span>
                        ) : (
                          <span className="packchip-price"><Coin size={11} /> {p.price}</span>
                        )}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={p.id}
                      className={"packchip" + (on ? " packchip-on" : "")}
                      disabled={!on && atMax}
                      onClick={() => togglePack(p.id)}
                    >
                      {p.name}<span className="packchip-count">{p.cards}</span>
                    </button>
                  );
                })}
                {filteredPacks.length === 0 ? (
                  <p className="pack-nomatch">No packs match “{packQuery}”</p>
                ) : null}
              </div>
              {lockedHint ? (
                <p className="packbox-hint packbox-hint-lock">
                  {lockedHint.adultLocked ? (
                    `“${lockedHint.name}” contains mature themes and cannot be used in family-friendly rooms.`
                  ) : (
                    <>“{lockedHint.name}” is locked — get it for <Coin size={12} /> {lockedHint.price} in the <button className="linkbtn" onClick={handleStore}>Marketplace</button></>
                  )}
                </p>
              ) : (
                <p className={"packbox-hint" + (atMax ? " packbox-hint-max" : "")}>
                  {atMax ? "Max " + MAX_PACKS + " packs \u2014 deselect one to swap" : "Pick up to " + MAX_PACKS + " packs"}
                </p>
              )}
            </div>
            {hasNSFWSelected ? (
              <div className="packbox-hint" style={{ color: '#ff4d4f', marginTop: '12px', fontWeight: 600, fontSize: '13px', background: 'rgba(255,77,79,0.08)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,77,79,0.15)', display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.4 }}>
                ⚠️ Disclaimer: You have selected mature (NSFW) content. Player discretion is advised.
              </div>
            ) : null}
          </section>
        </div>
        <div className="create-cta">
          <Btn big={true} disabled={packs.length === 0} onClick={handleCreate}>
            {packs.length === 0 ? "Pick at least 1 pack" : "Create room"}
          </Btn>
          <span className="create-cta-hint">You'll get a room code and invite link to share</span>
        </div>
      </div>
    </div>
  );
}
