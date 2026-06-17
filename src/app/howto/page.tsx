"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Btn, Avatar, PromptCard, AnswerCard, CrownIcon } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';

export default function HowToPlayPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  const handleCreate = () => {
    router.push('/create');
  };

  const steps = [
    {
      n: 1, title: "Gather your crew",
      body: "Create a room and share the 4-letter code or link. Three to twenty friends can pile in — on any phone or laptop, nothing to install.",
      art: (
        <div className="howto-art howto-art-players">
          {GAME_DATA.bots.slice(0, 4).map((b: any) => (
            <Avatar key={b.id} player={b} size={42} />
          ))}
          <span className="howto-code">GRUV</span>
        </div>
      )
    },
    {
      n: 2, title: "Read the prompt",
      body: "Every round opens with a black prompt card and a blank to fill. This is the setup — your job is the punchline.",
      art: <PromptCard text="My secret talent is ____." small={true} className="howto-prompt" />
    },
    {
      n: 3, title: "Play your funniest card",
      body: "You hold a hand of white answer cards. Pick the one that makes the prompt land hardest, then lock it in before the timer runs out.",
      art: (
        <div className="howto-art howto-art-hand">
          <AnswerCard text="a haunted Roomba" small={true} className="howto-fan-1" />
          <AnswerCard text="aggressive interpretive dance" small={true} selected={true} className="howto-fan-2" />
          <AnswerCard text="one single crouton" small={true} className="howto-fan-3" />
        </div>
      )
    },
    {
      n: 4, title: "The judge crowns a winner",
      body: "One player is the judge each round. All answers are shuffled and revealed anonymously — the judge picks the funniest and that player scores a point. The judge role rotates every round.",
      art: (
        <div className="howto-art howto-art-judge">
          <span className="howto-crown"><CrownIcon /></span>
          <AnswerCard text="aggressive interpretive dance" small={true} winner={true} />
        </div>
      )
    },
    {
      n: 5, title: "First to the finish wins",
      body: "Keep playing rounds until someone hits the score limit. React with 😂 💀 🔥 to your favorites along the way — then see the final podium and play again.",
      art: (
        <div className="howto-art howto-art-react">
          <span className="howto-emoji">😂</span>
          <span className="howto-emoji">🔥</span>
          <span className="howto-emoji">💀</span>
          <span className="howto-emoji">👏</span>
        </div>
      )
    }
  ];

  const tips = [
    { h: "Swap your hand", b: "Stuck with junk? Spend a swap to trade in cards for fresh ones after round 3." },
    { h: "Judge rotates", b: "Everyone takes a turn judging, so the deck is never stacked in one person's favor." },
    { h: "Coins & packs", b: "Finish games to earn coins, then unlock more card packs and bigger rooms in the Marketplace." }
  ];

  return (
    <div className="screen create-screen" data-screen-label="How to Play">
      <header className="create-head store-head">
        <button className="iconbtn create-back" onClick={handleBack} aria-label="Back">←</button>
        <Logo />
        <span className="howto-head-spacer"></span>
      </header>
      <div className="create-body howto-body">
        <h1 className="create-title howto-title" style={{ fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '8px' }}>How to play</h1>
        <p className="howto-lead" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 40px', opacity: 0.7 }}>Fill in the blank, make your friends laugh, win the round. That's the whole game.</p>

        <ol className="howto-steps" style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '48px', maxWidth: '800px', margin: '0 auto' }}>
          {steps.map((s) => (
            <li key={s.n} className="howto-step" style={{ display: 'flex', alignItems: 'center', gap: '32px', justifyContent: 'space-between' }}>
              <div className="howto-step-text" style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span className="howto-step-num" style={{ background: 'var(--accent)', color: 'var(--paper-fg)', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>{s.n}</span>
                  <h3 className="howto-step-title" style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{s.title}</h3>
                </div>
                <p className="howto-step-body" style={{ opacity: 0.7, fontSize: '14px', lineHeight: 1.5, margin: 0 }}>{s.body}</p>
              </div>
              <div className="howto-step-art" style={{ flexShrink: 0, width: '240px', display: 'flex', justifyContent: 'center' }}>{s.art}</div>
            </li>
          ))}
        </ol>

        <h3 className="howto-tips-title" style={{ fontSize: '24px', fontWeight: 800, textAlign: 'center', marginTop: '64px', marginBottom: '24px' }}>Good to know</h3>
        <div className="howto-tips" style={{ display: 'flex', gap: '24px', maxWidth: '800px', margin: '0 auto 48px' }}>
          {tips.map((t) => (
            <div key={t.h} className="howto-tip" style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="howto-tip-h" style={{ display: 'block', fontWeight: 800, fontSize: '16px', marginBottom: '8px' }}>{t.h}</span>
              <span className="howto-tip-b" style={{ display: 'block', fontSize: '13px', opacity: 0.7, lineHeight: 1.5 }}>{t.b}</span>
            </div>
          ))}
        </div>

        <div className="howto-cta" style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '40px' }}>
          <Btn big={true} onClick={handleCreate}>Create a room</Btn>
          <Btn big={true} variant="secondary" onClick={handleBack}>Back</Btn>
        </div>
      </div>
    </div>
  );
}
