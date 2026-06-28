"use client";

import React, { useState, useEffect } from 'react';
import { useGameContext } from '@/context/GameContext';
import { Btn, Coin } from '@/components/components';
import { X } from 'lucide-react';

interface FeedbackModalProps {
  open: boolean;
  showReward: boolean;
  code: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function FeedbackModal({ open, showReward, code, onClose, onSubmitted }: FeedbackModalProps) {
  const { account, buyCredits } = useGameContext();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const labels = ["", "Meh", "Okay", "Good", "Great", "Hilarious"];
  const shown = hover || rating;

  // Reset state when opening/closing
  useEffect(() => {
    if (open) {
      setRating(0);
      setHover(0);
      setSelectedReasons([]);
      setSent(false);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const getOptionsForRating = (num: number) => {
    if (num <= 2) {
      return [
        "Encountered bugs / glitches",
        "Cards were not funny",
        "Gameplay felt too slow",
        "UI was hard to navigate"
      ];
    } else if (num === 3) {
      return [
        "Need more card variety",
        "Decent, but needs polish",
        "Lobby settings were limited",
        "Bots could be improved"
      ];
    } else {
      return [
        "Loved the card humor!",
        "Super smooth gameplay",
        "Beautiful & clean UI",
        "Bots made it fun to play"
      ];
    }
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0 || selectedReasons.length === 0 || submitting) return;
    setSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          reasons: selectedReasons,
          comment: "",
          uid: account?.uid || null,
          email: account?.email || null,
          code: code || null,
          type: showReward ? 'game-end' : 'game-abort',
        })
      });

      if (response.ok) {
        // Trigger analytics event
        const { logAnalyticsEvent } = await import('@/firebase/config');
        logAnalyticsEvent('game_end_rating', {
          rating,
          reasons: selectedReasons.join(','),
          code: code || null,
          rewarded: showReward
        });

        // Award 5 coins if it's the game completion scenario
        if (showReward && account) {
          try {
            buyCredits({ coins: 5, tag: "Feedback bonus" });
          } catch (creditsErr) {
            console.error("Failed to credit feedback coins:", creditsErr);
          }
        }

        setSent(true);
        if (onSubmitted) {
          onSubmitted();
        }
      } else {
        console.error('Failed to submit rating from modal');
        alert('Failed to submit rating. Please try again.');
      }
    } catch (err) {
      console.error('Rating submit error:', err);
      alert('Error connecting to feedback server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <React.Fragment>
      <div className="scrim scrim-open" style={{ zIndex: 150 }} onClick={onClose}></div>
      <div 
        role="dialog"
        aria-label="Feedback Modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 151,
          background: 'var(--paper)',
          color: 'var(--paper-fg)',
          borderRadius: '24px',
          padding: '30px 32px',
          width: '420px',
          maxWidth: '90vw',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'popIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) both',
          textAlign: 'center'
        }}
      >
        <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'flex-end', height: 0, overflow: 'visible' }}>
          <button 
            type="button" 
            className="iconbtn" 
            onClick={onClose} 
            aria-label="Close"
            style={{ margin: '-10px -10px 0 0', position: 'relative', zIndex: 10 }}
          >
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="rate-done" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
            <span className="rate-check">✓</span>
            <span className="rate-thanks" style={{ fontSize: '18px' }}>Thanks for your feedback!</span>
            {showReward ? (
              <p style={{ margin: '4px 0 16px', fontSize: '14px', opacity: 0.9, color: 'var(--accent)' }}>
                🪙 5 coins have been added to your balance!
              </p>
            ) : (
              <p style={{ margin: '4px 0 16px', fontSize: '14px', opacity: 0.7 }}>
                Your insights help us build a better game experience.
              </p>
            )}
            <Btn big={true} onClick={onClose}>Done</Btn>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <span className="rate-q" style={{ fontSize: '20px', marginBottom: '4px' }}>How was that game?</span>
            
            {showReward && (
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 201, 60, 0.08)',
                  border: '1px solid rgba(255, 201, 60, 0.2)',
                  borderRadius: '12px',
                  padding: '8px 14px',
                  margin: '8px 0 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--accent)'
                }}
              >
                <Coin size={14} /> Earn 5 coins for sharing your thoughts!
              </div>
            )}

            <div className="rate-stars" onMouseLeave={() => setHover(0)} style={{ margin: '10px 0 4px' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={"rate-star" + (n <= shown ? " rate-star-on" : "")}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => { setRating(n); setSelectedReasons([]); }}
                  aria-label={n + " star" + (n > 1 ? "s" : "")}
                  style={{ fontSize: '38px', cursor: 'pointer' }}
                >
                  ★
                </button>
              ))}
            </div>
            
            <span className="rate-label" style={{ minHeight: '20px', fontSize: '14px' }}>
              {labels[shown] || "\u00A0"}
            </span>

            {rating > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '12px', width: '100%', animation: 'fadeIn 0.2s ease' }}>
                <span style={{ fontSize: '13px', opacity: 0.8, marginBottom: '8px', fontWeight: 600 }}>
                  {rating <= 2 ? "What went wrong?" : rating === 3 ? "How can we improve?" : "What did you love?"}
                </span>
                
                <div className="rate-chips" style={{ width: '100%' }}>
                  {getOptionsForRating(rating).map((opt) => {
                    const isSelected = selectedReasons.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        className={`rate-chip ${isSelected ? 'rate-chip-selected' : ''}`}
                        onClick={() => toggleReason(opt)}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                  <Btn variant="secondary" onClick={onClose} disabled={submitting}>Skip</Btn>
                  <button
                    type="button"
                    className="rate-submit-btn"
                    disabled={selectedReasons.length === 0 || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            )}
            
            {rating === 0 && (
              <div style={{ marginTop: '20px' }}>
                <Btn variant="ghost" onClick={onClose}>Skip / Close</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </React.Fragment>
  );
}
