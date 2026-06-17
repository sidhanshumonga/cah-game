"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Btn } from '@/components/components';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="screen create-screen" data-screen-label="Privacy Policy">
      <header className="create-head">
        <button className="iconbtn create-back" onClick={() => router.back()} aria-label="Back">←</button>
        <Logo />
      </header>
      <div className="create-body" style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'left', lineHeight: 1.6 }}>
        <h1 className="create-title">Privacy Policy</h1>
        <p className="muted" style={{ fontSize: '14px', marginBottom: '30px' }}>Last updated: June 16, 2026</p>
        
        <section style={{ margin: '24px 0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>1. Data Collection</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            We only collect public profile information provided by Google OAuth (your name, email address, profile photo URL) when you sign in, which is used to manage game profiles, coin balances, and room host configurations. No other tracking or personal data collection is performed.
          </p>
        </section>

        <section style={{ margin: '24px 0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>2. Cookies and Storage</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            We use browser Local Storage to cache your active game session, coin balance, and room settings locally on your device for responsiveness. These files are strictly functional and do not contain tracking cookies.
          </p>
        </section>

        <section style={{ margin: '24px 0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>3. Data Storage & Firestore</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            User profiles and unlocked packages are stored securely in Google Cloud Firestore. This data is kept strictly private, never shared with third parties, and is only accessed to coordinate real-time game play.
          </p>
        </section>

        <section style={{ margin: '24px 0' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>4. Content Moderation</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            We do not actively review or scan private multiplayer rooms. However, if any public rooms or user accounts are flagged for illegal or severely abusive content, we reserve the right to remove the content and restrict associated client access.
          </p>
        </section>

        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center' }}>
          <Btn onClick={() => router.back()}>Close</Btn>
        </div>
      </div>
    </div>
  );
}
