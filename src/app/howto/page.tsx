"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Btn, Avatar, PromptCard, AnswerCard, CrownIcon } from '@/components/components';
import { GAME_DATA } from '@/data/game-data';
import { ChevronLeft } from 'lucide-react';

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
        <button className="iconbtn create-back" onClick={handleBack} aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <Logo />
        <span className="howto-head-spacer"></span>
      </header>
      <div className="create-body howto-body">
        <h1 className="create-title howto-title">How to play</h1>
        <p className="howto-lead">Fill in the blank, make your friends laugh, win the round. That's the whole game.</p>

        <ol className="howto-steps">
          {steps.map((s) => (
            <li key={s.n} className="howto-step">
              <div className="howto-step-text">
                <div className="howto-step-header">
                  <span className="howto-step-num">{s.n}</span>
                  <h3 className="howto-step-title">{s.title}</h3>
                </div>
                <p className="howto-step-body">{s.body}</p>
              </div>
              <div className="howto-step-art">{s.art}</div>
            </li>
          ))}
        </ol>

        <h3 className="howto-tips-title">Good to know</h3>
        <div className="howto-tips">
          {tips.map((t) => (
            <div key={t.h} className="howto-tip">
              <span className="howto-tip-h">{t.h}</span>
              <span className="howto-tip-b">{t.b}</span>
            </div>
          ))}
        </div>

        <div className="howto-cta">
          <Btn big={true} onClick={handleCreate}>Create a room</Btn>
          <Btn big={true} variant="secondary" onClick={handleBack}>Back</Btn>
        </div>
      </div>
    </div>
  );
}
