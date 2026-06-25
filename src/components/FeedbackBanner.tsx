"use client";

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { Btn } from '@/components/components';
import { Megaphone, Bot } from 'lucide-react';

export default function FeedbackBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const { account, isHydrated } = useGameContext();

  // Load dismissed state on mount
  useEffect(() => {
    if (isHydrated) {
      const stored = localStorage.getItem('cah-banner-dismissed-joinfix');
      if (!stored) {
        setDismissed(false);
      }
    }
  }, [isHydrated]);

  const handleDismiss = () => {
    localStorage.setItem('cah-banner-dismissed-joinfix', 'true');
    setDismissed(true);
  };

  async function submit() {
    if (!text.trim()) return;
    try {
      const path = typeof window !== 'undefined' ? window.location.pathname : 'global';
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: text.trim(),
          uid: account?.uid || null,
          email: account?.email || null,
          type: `banner-${path}`,
        })
      });
      if (response.ok) {
        setSent(true);
        setTimeout(() => {
          setOpen(false);
          setTimeout(() => {
            setSent(false);
            setText("");
          }, 300);
        }, 1400);
      } else {
        console.error('Failed to submit feedback');
      }
    } catch (err) {
      console.error('Feedback submit error:', err);
    }
  }

  return (
    <React.Fragment>
      {/* 1. Global Dismissible Banner */}
      {!dismissed && (
        <div className="feedback-banner">
          <span className="feedback-banner-text">
            <Megaphone className="inline-icon" size={14} /> <strong>Joining issues are now resolved!</strong> Drop your <button className="feedback-banner-link" onClick={() => setOpen(true)}>feedback or suggestions</button> here. 
            <strong> Bots are now live! Next up: Smart AI Bots coming soon! <Bot className="inline-icon" size={14} /></strong>
          </span>
          <button type="button" className="feedback-banner-close" onClick={handleDismiss} aria-label="Close banner">✕</button>
        </div>
      )}

      {/* 2. Global Feedback Dialog */}
      <div className={"fbtab" + (open ? " fbtab-open" : "")}>
        {open ? (
          <div className="fbpop">
            {sent ? (
              <div className="fbpop-done">
                <span className="rate-check">✓</span>
                <span className="rate-thanks">Thanks — we read every note.</span>
              </div>
            ) : (
              <React.Fragment>
                <div className="fbpop-head">
                  <span className="fbpop-title">Got feedback?</span>
                  <button type="button" className="iconbtn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
                </div>
                <p className="fbpop-sub">Bug, idea, or feature suggestions — drop it here.</p>
                <textarea
                  className="input fbpop-area"
                  rows={3}
                  placeholder="What's on your mind?"
                  value={text}
                  maxLength={400}
                  autoFocus={true}
                  onChange={(e) => setText(e.target.value)}
                ></textarea>
                <div className="fbpop-foot">
                  <Btn disabled={!text.trim()} onClick={submit}>Send feedback</Btn>
                </div>
              </React.Fragment>
            )}
          </div>
        ) : null}
        
        {/* Floating feedback button (visible when banner is dismissed) */}
        {dismissed && !open && (
          <button type="button" className="fbbtn" onClick={() => setOpen(true)}>
            <span className="fbbtn-dot"></span> Feedback
          </button>
        )}
      </div>
    </React.Fragment>
  );
}
