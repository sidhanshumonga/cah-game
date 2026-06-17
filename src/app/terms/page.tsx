"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Btn } from '@/components/components';

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="screen create-screen" data-screen-label="Terms of Service">
      <header className="create-head">
        <button className="iconbtn create-back" onClick={() => router.back()} aria-label="Back">←</button>
        <Logo />
      </header>
      <div className="create-body" style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'left', lineHeight: 1.6 }}>
        <h1 className="create-title">Terms of Service</h1>
        <p className="muted" style={{ fontSize: '14px', marginBottom: '30px' }}>Last updated: June 16, 2026</p>
        
        <section style={{ margin: '24px 0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>1. Age Requirement</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            You must be at least 18 years of age (or the age of majority in your jurisdiction) to play this game. This game contains mature humor, adult themes, suggestive references, and offensive statements designed solely for satirical purposes.
          </p>
        </section>

        <section style={{ margin: '24px 0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>2. Satire & Entertainment Disclaimer</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            This application is a satirical party game. All card content, prompts, and answers are intended solely for humor, satire, and comedic value. None of the content reflects the personal views, beliefs, or intentions of the developers, creators, or hosts of this application.
          </p>
        </section>

        <section style={{ margin: '24px 0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>3. User-Generated Content</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            If you submit custom cards, prompts, or custom room names, you agree that you are solely responsible for the content of your submissions. You warrant that you will not post content that violates copyright, is explicitly hate-speech, or is illegal under local, state, or federal laws. The developers reserve the right to remove custom lobbies or accounts displaying illegal or severely abusive content.
          </p>
        </section>

        <section style={{ margin: '24px 0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>4. Simulated Coins and Shop</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            All coin balances, marketplace expansion packs, and account upgrades are fully simulated. No real currency is used or exchanged on this platform. Users do not acquire any proprietary or monetary interest in simulated game items.
          </p>
        </section>

        <section style={{ margin: '24px 0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>5. Limitation of Liability</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE DEVELOPERS AND HOSTS SHALL NOT BE LIABLE FOR ANY DAMAGES, OFFENSE, EMOTIONAL DISTRESS, OR LOSS ARISING FROM THE USE OF THIS SATIRICAL APPLICATION.
          </p>
        </section>

        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center' }}>
          <Btn onClick={() => router.back()}>I Understand</Btn>
        </div>
      </div>
    </div>
  );
}
