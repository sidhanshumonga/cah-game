"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { Avatar, Coin, Logo, Btn } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';

export default function ProfilePage() {
  const router = useRouter();
  const { account, isHydrated, logout, packs, updateProfile } = useGameContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    if (isHydrated && !account) {
      router.replace('/login');
    }
  }, [isHydrated, account, router]);

  const a = account;

  useEffect(() => {
    if (a) {
      setEditName(a.name);
      setEditColor(a.color);
    }
  }, [a]);

  if (!isHydrated || !account) {
    return (
      <div className="screen center-screen">
        <div className="waiting-text">Loading profile...</div>
      </div>
    );
  }

  const freePacks = packs.filter((p) => p.free || p.id === 'classic');
  const ownedPaid = packs.filter((p) => !(p.free || p.id === 'classic') && a.packs.includes(p.id));
  const ownedUpgrades = GAME_DATA.upgrades.filter((u) => a.upgrades.includes(u.id));

  const handleBack = () => {
    router.push('/');
  };

  const handleStore = () => {
    router.push('/store');
  };

  const handleCoins = () => {
    router.push('/coins');
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="screen create-screen" data-screen-label="Profile">
      <header className="create-head">
        <button className="iconbtn create-back" onClick={handleBack} aria-label="Back">←</button>
        <Logo />
      </header>
      <div className="create-body">
        {isEditing ? (
          <div className="profile-hero profile-edit-mode">
            <Avatar player={{ name: editName, color: editColor }} size={72} />
            <div className="profile-id" style={{ width: '100%', maxWidth: '360px' }}>
              <div className="frow" style={{ marginBottom: '12px' }}>
                <label className="flabel" style={{ fontSize: '13px', fontWeight: 600 }}>Display Name</label>
                <input
                  className="input"
                  maxLength={14}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="frow" style={{ marginBottom: '16px' }}>
                <label className="flabel" style={{ fontSize: '13px', fontWeight: 600 }}>Avatar Color</label>
                <div className="colorrow">
                  {["#FF5C39", "#7C5CFF", "#2BC4BE", "#FF4D8D", "#5CA9FF", "#FFC93C"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={"colordot" + (editColor === color ? " colordot-on" : "")}
                      style={{ background: color, width: '28px', height: '28px' }}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="profile-hero-actions" style={{ gap: '10px' }}>
              <Btn variant="accent" disabled={!editName.trim()} onClick={async () => {
                await updateProfile({ name: editName.trim(), color: editColor });
                setIsEditing(false);
              }}>
                Save Changes
              </Btn>
              <Btn variant="secondary" onClick={() => {
                if (a) {
                  setEditName(a.name);
                  setEditColor(a.color);
                }
                setIsEditing(false);
              }}>
                Cancel
              </Btn>
            </div>
          </div>
        ) : (
          <div className="profile-hero">
            <Avatar player={a} size={72} />
            <div className="profile-id">
              <h2 className="profile-name">{a.name}{a.guest ? " (guest)" : ""}</h2>
              <span className="profile-email">{a.email || "No email — guest account"}</span>
              <span className="profile-meta">{a.games} games · {a.wins} wins · joined {new Date(a.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="profile-hero-actions">
              <Btn variant="secondary" onClick={handleEdit}>Edit profile</Btn>
              <Btn variant="ghost" onClick={handleLogout}>Log out</Btn>
            </div>
          </div>
        )}

        <div className="profile-grid">
          <section className="profile-card profile-balance">
            <span className="store-sec-label">Balance</span>
            <span className="balance-big"><Coin size={26} /> {a.credits.toLocaleString()}</span>
            <Btn variant="accent" onClick={handleCoins}>Get more coins</Btn>
          </section>

          <section className="profile-card">
            <span className="store-sec-label">Your packs <span className="muted">{freePacks.length + ownedPaid.length}</span></span>
            <div className="profile-chips">
              {freePacks.map((p) => (
                <span key={p.id} className="packchip packchip-on profile-chip-static">{p.name}<span className="packchip-count">free</span></span>
              ))}
              {ownedPaid.map((p) => (
                <span key={p.id} className="packchip packchip-on profile-chip-static">{p.name}<span className="packchip-count">{p.cards}</span></span>
              ))}
            </div>
            <button className="linkbtn" onClick={handleStore}>Browse more packs →</button>
          </section>

          <section className="profile-card">
            <span className="store-sec-label">Upgrades</span>
            {ownedUpgrades.length ? (
              <ul className="profile-upglist">
                {ownedUpgrades.map((u) => (
                  <li key={u.id}><b>{u.name}</b><span className="muted"> — {u.desc}</span></li>
                ))}
              </ul>
            ) : (
              <p className="muted profile-empty">No upgrades yet. Bigger rooms and card swaps await.</p>
            )}
            <button className="linkbtn" onClick={handleStore}>See upgrades →</button>
          </section>

          <section className="profile-card profile-history">
            <span className="store-sec-label">Coin history</span>
            {a.history.length ? (
              <ul className="historylist">
                {a.history.slice(0, 8).map((h, i) => (
                  <li key={i} className="historyrow">
                    <span className="history-label">{h.label}</span>
                    <span className={"history-delta" + (h.delta > 0 ? " history-plus" : "")}>
                      {h.delta > 0 ? "+" : ""}{h.delta}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted profile-empty">Nothing yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
