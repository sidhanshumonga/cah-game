"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';
import { Logo, Btn, Avatar } from '@/components/components';
import { auth } from '@/firebase/config';
import { ChevronLeft, ChevronUp, MessageSquare, X, LogIn, AlertCircle, Lightbulb, Bug } from 'lucide-react';

/* ---------- Status + type vocabulary ---------- */
interface StatusConfig {
  label: string;
  short: string;
  color: string;
  roadmap: boolean;
}

const FB_STATUS: Record<string, StatusConfig> = {
  review:   { label: "Under Review", short: "Reviewing", color: "var(--fg)",          roadmap: true },
  planned:  { label: "Planned",      short: "Planned",   color: "var(--accent2)",      roadmap: true },
  progress: { label: "In Progress",  short: "Building",  color: "var(--accent)",       roadmap: true },
  complete: { label: "Complete",     short: "Shipped",   color: "var(--accent-paper)", roadmap: true }
};

const FB_STATUS_ORDER = ["review", "planned", "progress", "complete"];

const FB_TYPES: Record<string, { label: string; color: string }> = {
  feature: { label: "Feature", color: "var(--accent2)" },
  bug:     { label: "Bug",     color: "#E5484D" }
};

// Map Canny statuses to our local UI keys
function mapCannyStatus(statusStr: string): string {
  switch (statusStr?.toLowerCase()) {
    case 'planned':
      return 'planned';
    case 'in progress':
      return 'progress';
    case 'complete':
    case 'completed':
      return 'complete';
    case 'under review':
    case 'open':
    default:
      return 'review';
  }
}

// Map Canny custom categories to feature/bug
function mapCannyType(categoryName: string): string {
  if (categoryName?.toLowerCase().includes('bug')) {
    return 'bug';
  }
  return 'feature';
}

interface CannyPost {
  id: string;
  title: string;
  details: string;
  type: string; // 'feature' or 'bug'
  status: string; // local status key
  votes: number;
  voted: boolean;
  createdAt: number;
  commentCount: number;
  author: {
    id: string;
    name: string;
    avatarURL?: string;
  };
}

interface CannyComment {
  id: string;
  value: string;
  createdAt: number;
  author: {
    id: string;
    name: string;
    avatarURL?: string;
    admin?: boolean;
  };
}

export default function FeedbackPage() {
  const router = useRouter();
  const { account, isHydrated } = useGameContext();

  const [posts, setPosts] = useState<CannyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState<"board" | "roadmap">("board");
  const [typeF, setTypeF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [sort, setSort] = useState("trending");
  const [q, setQ] = useState("");

  // Detailed view drawer state
  const [openId, setOpenId] = useState<string | null>(null);
  const [comments, setComments] = useState<CannyComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  // Submitting modal state
  const [submitting, setSubmitting] = useState(false);
  const [submitType, setSubmitType] = useState("feature");
  const [submitTitle, setSubmitTitle] = useState("");
  const [submitDetails, setSubmitDetails] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Authentication prompt modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authReason, setAuthReason] = useState("");

  // Local vote cache to persist click feedback instantaneously
  const [localVotes, setLocalVotes] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Is the current user authenticated via Google?
  const isGoogleUser = account && !account.guest && auth?.currentUser;

  // Hashing helper for avatar background colors
  const getPlayerColor = (name: string) => {
    const colors = ["#FF5C39", "#FFC93C", "#7C5CFF", "#2BC4BE", "#FF4D8D", "#5CA9FF"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Load local votes state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cah-canny-votes');
        if (stored) setLocalVotes(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Fetch Canny Posts
  const fetchPosts = async () => {
    setLoading(true);
    setError("");
    try {
      // Build search params
      const params = new URLSearchParams();
      if (sort === 'trending') params.append('sort', 'trending');
      else if (sort === 'top') params.append('sort', 'score');
      else if (sort === 'new') params.append('sort', 'newest');

      const res = await fetch(`/api/canny/posts?${params.toString()}`);
      if (!res.ok) {
        throw new Error(await res.text() || 'Failed to load feedback posts');
      }
      const data = await res.json();
      
      if (data.posts) {
        const formatted: CannyPost[] = data.posts.map((p: any) => ({
          id: p.id,
          title: p.title,
          details: p.details || "",
          type: p.category ? mapCannyType(p.category.name) : 'feature',
          status: mapCannyStatus(p.status),
          votes: p.score || 0,
          voted: false, // will resolve via localVotes
          commentCount: p.commentCount || 0,
          createdAt: new Date(p.created).getTime(),
          author: {
            id: p.author?.id || "unknown",
            name: p.author?.name || "Anonymous",
            avatarURL: p.author?.avatarURL
          }
        }));
        setPosts(formatted);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to connect to Canny API. Make sure environment variables are set.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch on mount or sort change
  useEffect(() => {
    if (isHydrated) {
      fetchPosts();
    }
  }, [isHydrated, sort]);

  // Fetch Comments when detail drawer opens
  useEffect(() => {
    if (!openId) {
      setComments([]);
      return;
    }

    const fetchComments = async () => {
      setLoadingComments(true);
      try {
        const res = await fetch(`/api/canny/comments?postId=${openId}`);
        if (!res.ok) throw new Error('Failed to fetch comments');
        const data = await res.json();
        
        if (data.comments) {
          const formatted: CannyComment[] = data.comments.map((c: any) => ({
            id: c.id,
            value: c.value,
            createdAt: new Date(c.created).getTime(),
            author: {
              id: c.author?.id || "unknown",
              name: c.author?.name || "Anonymous",
              avatarURL: c.author?.avatarURL,
              admin: c.author?.isAdmin || false
            }
          }));
          setComments(formatted.sort((a, b) => a.createdAt - b.createdAt));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingComments(false);
      }
    };

    fetchComments();
  }, [openId]);

  // Handle upvoting
  const handleVote = async (postId: string) => {
    if (!isGoogleUser) {
      setAuthReason("vote on feature requests and bug reports");
      setShowAuthModal(true);
      return;
    }

    const currentlyVoted = !!localVotes[postId];
    const newVoted = !currentlyVoted;

    // Optimistically update local UI votes
    const updatedVotes = { ...localVotes, [postId]: newVoted };
    setLocalVotes(updatedVotes);
    localStorage.setItem('cah-canny-votes', JSON.stringify(updatedVotes));

    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          votes: p.votes + (newVoted ? 1 : -1)
        };
      }
      return p;
    }));

    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
      const response = await fetch('/api/canny/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          postId,
          vote: newVoted
        })
      });

      if (!response.ok) {
        throw new Error('Vote submit failed');
      }
    } catch (err) {
      console.error('[Canny UI Vote Error] Reverting optimistic vote:', err);
      // Revert on error
      const revertedVotes = { ...localVotes, [postId]: currentlyVoted };
      if (!currentlyVoted) delete revertedVotes[postId];
      setLocalVotes(revertedVotes);
      localStorage.setItem('cah-canny-votes', JSON.stringify(revertedVotes));
      
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            votes: p.votes + (currentlyVoted ? 1 : -1)
          };
        }
        return p;
      }));
    }
  };

  // Handle post creation
  const handleCreatePost = async () => {
    if (!submitTitle.trim()) return;
    if (!isGoogleUser) {
      setAuthReason("suggest new features or report bugs");
      setShowAuthModal(true);
      return;
    }

    setActionLoading(true);
    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
      const response = await fetch('/api/canny/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          title: submitTitle.trim(),
          details: submitDetails.trim() || "(no extra detail added)"
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to submit post');
      }

      const created = await response.json();
      
      setSubmitTitle("");
      setSubmitDetails("");
      setSubmitting(false);

      // Trigger success toast
      showToast("Posted successfully! It is now live under Under Review.");

      // Refresh list and open new post details
      await fetchPosts();
      if (created && created.id) {
        setTimeout(() => setOpenId(created.id), 400);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error submitting feedback. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle posting a comment
  const handleSendComment = async () => {
    if (!commentText.trim() || !openId) return;
    if (!isGoogleUser) {
      setAuthReason("participate in the comments discussion");
      setShowAuthModal(true);
      return;
    }

    setActionLoading(true);
    try {
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : '';
      const response = await fetch('/api/canny/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          postId: openId,
          value: commentText.trim()
        })
      });

      if (!response.ok) throw new Error('Comment submit failed');
      const newComment = await response.json();

      // Append new comment locally
      const formatted: CannyComment = {
        id: newComment.id,
        value: newComment.value,
        createdAt: new Date(newComment.created).getTime(),
        author: {
          id: newComment.author?.id || "me",
          name: newComment.author?.name || account?.name || "Me",
          avatarURL: newComment.author?.avatarURL || account?.color,
          admin: false
        }
      };

      setComments(prev => [...prev, formatted]);
      setCommentText("");
      
      // Update comment count on post row
      setPosts(prev => prev.map(p => {
        if (p.id === openId) {
          return {
            ...p,
            commentCount: p.commentCount + 1
          };
        }
        return p;
      }));
    } catch (err) {
      console.error(err);
      alert('Failed to post comment. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger standard notification toast
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4200);
  };

  const fbTimeAgo = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24); if (d < 30) return d + "d ago";
    const mo = Math.floor(d / 30); return mo + "mo ago";
  };

  // Client filtering & searching
  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      const typeMatches = typeF === 'all' || p.type === typeF;
      const statusMatches = statusF === 'all' || p.status === statusF;
      const queryMatches = !q.trim() || 
        p.title.toLowerCase().includes(q.toLowerCase()) || 
        p.details.toLowerCase().includes(q.toLowerCase());
      return typeMatches && statusMatches && queryMatches;
    });
  }, [posts, typeF, statusF, q]);

  // Aggregate type counts
  const counts = useMemo(() => {
    return {
      all: posts.length,
      feature: posts.filter(p => p.type === 'feature').length,
      bug: posts.filter(p => p.type === 'bug').length
    };
  }, [posts]);

  const openPost = openId ? posts.find(p => p.id === openId) : null;

  return (
    <div className="screen create-screen fb" data-screen-label="Feedback & Roadmap">
      <header className="create-head store-head">
        <button className="iconbtn create-back" onClick={() => router.push('/')} aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <Logo />
        <span className="fb-head-cta">
          <Btn variant="accent" onClick={() => {
            if (!isGoogleUser) {
              setAuthReason("suggest new features or report bugs");
              setShowAuthModal(true);
            } else {
              setSubmitting(true);
            }
          }}>
            <span className="fb-btn-text-desktop">Suggest something</span>
            <span className="fb-btn-text-mobile">Suggest</span>
          </Btn>
        </span>
      </header>

      <div className="create-body fb-body">
        <div className="fb-intro">
          <h1 className="create-title fb-title">Feedback &amp; Roadmap</h1>
          <p className="fb-lead">Tell us what to build, vote on what matters, and watch it move from idea to shipped. The most-loved ideas get picked — here's where they stand.</p>
        </div>

        <div className="fb-viewtabs">
          <button className={"fb-vt" + (view === "board" ? " fb-vt-on" : "")} onClick={() => setView("board")}>Board</button>
          <button className={"fb-vt" + (view === "roadmap" ? " fb-vt-on" : "")} onClick={() => setView("roadmap")}>Roadmap</button>
        </div>

        {loading && posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', opacity: 0.6 }}>
            <div className="ptile-empty" style={{ border: '0', minHeight: 'auto' }}>
              Loading feedback entries from Canny...
            </div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#ff4d4f', background: 'rgba(255,77,79,0.06)', borderRadius: '16px' }}>
            <p style={{ fontWeight: 600, fontSize: '17px', margin: '0 0 8px' }}>Connection Error</p>
            <p style={{ fontSize: '14px', margin: 0, opacity: 0.85 }}>{error}</p>
          </div>
        ) : view === "board" ? (
          <React.Fragment>
            <div className="fb-toolbar">
              <input className="input fb-search" placeholder="Search requests &amp; bugs…" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="input fb-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="trending">Trending</option>
                <option value="top">Most voted</option>
                <option value="new">Newest</option>
              </select>
            </div>
            <div className="fb-filters">
              <div className="fb-filtergroup">
                {[["all", "All"], ["feature", "Features"], ["bug", "Bugs"]].map(([k, l]) => (
                  <button key={k} className={"packchip" + (typeF === k ? " packchip-on" : "")} onClick={() => setTypeF(k)}>
                    {l}<span className="packchip-count">{counts[k as keyof typeof counts] || 0}</span>
                  </button>
                ))}
              </div>
              <div className="fb-filtergroup">
                <button className={"packchip" + (statusF === "all" ? " packchip-on" : "")} onClick={() => setStatusF("all")}>Any status</button>
                {FB_STATUS_ORDER.map((st) => (
                  <button key={st} className={"packchip" + (statusF === st ? " packchip-on" : "")} onClick={() => setStatusF(st)}>
                    {FB_STATUS[st].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="fb-list" style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              {filteredPosts.map((p) => {
                const isVoted = !!localVotes[p.id];
                const displayVotes = p.votes + (isVoted ? 1 : 0);

                return (
                  <div key={p.id} className="fb-post" role="button" tabIndex={0} onClick={() => setOpenId(p.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(p.id); } }}>
                    
                    <button
                      className={"fb-vote" + (isVoted ? " fb-voted" : "")}
                      onClick={(e) => { e.stopPropagation(); handleVote(p.id); }}
                      aria-pressed={isVoted}
                    >
                      <ChevronUp size={15} />
                      <span className="fb-vote-num">{displayVotes}</span>
                    </button>

                    <span className="fb-post-main">
                      <span className="fb-post-top">
                        <span className="fb-tag" style={{ "--tag": FB_TYPES[p.type].color } as React.CSSProperties}>{FB_TYPES[p.type].label}</span>
                        <span className="fb-status fb-status-sm" style={{ "--stat": FB_STATUS[p.status].color } as React.CSSProperties}>
                          <span className="fb-status-dot"></span>
                          {FB_STATUS[p.status].short}
                        </span>
                      </span>
                      <span className="fb-post-title">{p.title}</span>
                      <span className="fb-post-body">{p.details}</span>
                      <span className="fb-post-meta">
                        <Avatar player={{ name: p.author.name, color: getPlayerColor(p.author.name) }} size={18} /> {p.author.name}
                        <span className="fb-dot">·</span>{fbTimeAgo(p.createdAt)}
                        <span className="fb-dot">·</span>
                        <span className="fb-cc">
                          <MessageSquare size={13} style={{ marginRight: 4, verticalAlign: "-2px" }} />
                          {p.commentCount}
                        </span>
                      </span>
                    </span>
                  </div>
                );
              })}
              {filteredPosts.length === 0 ? (
                <div className="fb-empty">
                  <p className="fb-empty-h">Nothing matches that.</p>
                  <p className="fb-empty-b">Try clearing filters — or be the first to suggest it.</p>
                  <Btn variant="accent" onClick={() => {
                    if (!isGoogleUser) {
                      setAuthReason("suggest new features or report bugs");
                      setShowAuthModal(true);
                    } else {
                      setSubmitting(true);
                    }
                  }}>Suggest it</Btn>
                </div>
              ) : null}
            </div>
          </React.Fragment>
        ) : (
          <div className="fb-roadmap" style={{ opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
            {FB_STATUS_ORDER.map((st) => {
              const col = posts.filter((p) => p.status === st).sort((a, b) => b.votes - a.votes);
              return (
                <section key={st} className="fb-rm-col">
                  <header className="fb-rm-head">
                    <span className="fb-status" style={{ "--stat": FB_STATUS[st].color } as React.CSSProperties}>
                      <span className="fb-status-dot"></span>
                      {FB_STATUS[st].label}
                    </span>
                    <span className="fb-rm-count">{col.length}</span>
                  </header>
                  <div className="fb-rm-list">
                    {col.map((p) => {
                      const isVoted = !!localVotes[p.id];
                      const displayVotes = p.votes + (isVoted ? 1 : 0);

                      return (
                        <div key={p.id} className="fb-rm-card" role="button" tabIndex={0} onClick={() => setOpenId(p.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(p.id); } }}>
                          <span className="fb-rm-card-top">
                            <span className="fb-tag" style={{ "--tag": FB_TYPES[p.type].color } as React.CSSProperties}>{FB_TYPES[p.type].label}</span>
                            <span className="fb-cc fb-rm-cc">
                              <MessageSquare size={12} style={{ marginRight: 3 }} />
                              {p.commentCount}
                            </span>
                          </span>
                          <span className="fb-rm-title">{p.title}</span>
                          <span className="fb-rm-foot">
                            <button
                              className={"fb-vote" + (isVoted ? " fb-voted" : "")}
                              onClick={(e) => { e.stopPropagation(); handleVote(p.id); }}
                              aria-pressed={isVoted}
                              style={{ width: '46px', padding: '7px 0', flexDirection: 'row', gap: '5px' }}
                            >
                              <ChevronUp size={13} />
                              <span className="fb-vote-num" style={{ fontSize: '14px' }}>{displayVotes}</span>
                            </button>
                          </span>
                        </div>
                      );
                    })}
                    {col.length === 0 ? <p className="fb-rm-empty">Nothing here yet.</p> : null}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* DETAILED VIEW SLIDE-OVER */}
      {openPost && (
        <React.Fragment>
          <div className="scrim scrim-open" onClick={() => setOpenId(null)}></div>
          <aside className="scorepanel fb-detail scorepanel-open">
            <div className="fb-detail-scroll">
              <div className="fb-detail-head">
                <div className="fb-detail-tags">
                  <span className="fb-tag" style={{ "--tag": FB_TYPES[openPost.type].color } as React.CSSProperties}>{FB_TYPES[openPost.type].label}</span>
                  <span className="fb-status" style={{ "--stat": FB_STATUS[openPost.status].color } as React.CSSProperties}>
                    <span className="fb-status-dot"></span>
                    {FB_STATUS[openPost.status].label}
                  </span>
                </div>
                <button className="iconbtn" onClick={() => setOpenId(null)} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <div className="fb-detail-titlerow">
                <button
                  className={"fb-vote fb-vote-big" + (!!localVotes[openPost.id] ? " fb-voted" : "")}
                  onClick={() => handleVote(openPost.id)}
                >
                  <ChevronUp size={18} />
                  <span className="fb-vote-num">{openPost.votes + (!!localVotes[openPost.id] ? 1 : 0)}</span>
                </button>
                <h3 className="fb-detail-title">{openPost.title}</h3>
              </div>
              <p className="fb-detail-by">
                <Avatar player={{ name: openPost.author.name, color: getPlayerColor(openPost.author.name) }} size={20} /> {openPost.author.name}
                <span className="fb-dot">·</span>{fbTimeAgo(openPost.createdAt)}
              </p>
              <p className="fb-detail-body">{openPost.details}</p>

              <h4 className="fb-detail-sec">Discussion <span className="muted">{comments.length}</span></h4>
              
              <ul className="fb-comments">
                {loadingComments ? (
                  <li className="fb-comment-empty">Loading comments...</li>
                ) : comments.length === 0 ? (
                  <li className="fb-comment-empty">No comments yet — be the first.</li>
                ) : (
                  comments.map((c) => (
                    <li key={c.id} className={"fb-comment" + (c.author.admin ? " fb-comment-staff" : "")}>
                      <Avatar player={{ name: c.author.name, color: getPlayerColor(c.author.name) }} size={28} />
                      <span className="fb-comment-body">
                        <span className="fb-comment-name">
                          {c.author.name}
                          {c.author.admin && <span className="fb-staff-pill">Team</span>}
                          <span className="fb-comment-when">{fbTimeAgo(c.createdAt)}</span>
                        </span>
                        <span className="fb-comment-text">{c.value}</span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            
            <div className="fb-comment-add">
              <input 
                className="input" 
                placeholder="Add a comment…" 
                value={commentText}
                maxLength={240} 
                disabled={actionLoading}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !actionLoading) handleSendComment(); }} 
              />
              <Btn disabled={!commentText.trim() || actionLoading} onClick={handleSendComment}>
                {actionLoading ? "..." : "Post"}
              </Btn>
            </div>
          </aside>
        </React.Fragment>
      )}

      {/* SUGGEST SUBMISSION MODAL */}
      {submitting && (
        <React.Fragment>
          <div className="scrim scrim-open" onClick={() => setSubmitting(false)}></div>
          <div className="fb-modal fb-modal-sheet" role="dialog" aria-label="Suggest something">
            <div className="fb-modal-head">
              <h3 className="fb-modal-title">What's on your mind?</h3>
              <button className="iconbtn" onClick={() => setSubmitting(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="fb-modal-sub">Pitch a feature or flag a bug. Pile up votes and we'll move it onto the roadmap.</p>
            <div className="fb-seg">
              <button className={"fb-seg-btn" + (submitType === "feature" ? " fb-seg-on" : "")} onClick={() => setSubmitType("feature")}>
                <Lightbulb size={16} /> Feature idea
              </button>
              <button className={"fb-seg-btn" + (submitType === "bug" ? " fb-seg-on" : "")} onClick={() => setSubmitType("bug")}>
                <Bug size={16} /> Bug report
              </button>
            </div>
            <div className="frow">
              <label className="flabel">Title</label>
              <input className="input" autoFocus={true} maxLength={80} value={submitTitle} disabled={actionLoading}
                placeholder={submitType === "bug" ? "e.g. Cards overlap on my phone" : "e.g. Let us pin a favorite pack"}
                onChange={(e) => setSubmitTitle(e.target.value)} />
            </div>
            <div className="frow">
              <label className="flabel">Details <span className="muted">optional</span></label>
              <textarea className="input fb-modal-area" rows={4} maxLength={400} value={submitDetails} disabled={actionLoading}
                placeholder="What would it do, or what went wrong? The more we know, the faster it moves."
                onChange={(e) => setSubmitDetails(e.target.value)}></textarea>
            </div>
            <div className="fb-modal-foot">
              <Btn variant="ghost" disabled={actionLoading} onClick={() => setSubmitting(false)}>Cancel</Btn>
              <Btn disabled={!submitTitle.trim() || actionLoading} onClick={handleCreatePost}>
                {actionLoading ? "Posting..." : "Post it"}
              </Btn>
            </div>
          </div>
        </React.Fragment>
      )}

      {/* GOOGLE AUTHENTICATION REQUIRED PROMPT MODAL */}
      {showAuthModal && (
        <React.Fragment>
          <div className="scrim scrim-open" style={{ zIndex: 110 }} onClick={() => setShowAuthModal(false)}></div>
          <div className="fb-modal fb-modal-dialog" role="dialog" aria-label="Google login required" style={{ zIndex: 112 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(143,123,255,0.1)', display: 'grid', placeItems: 'center', color: 'var(--accent2)' }}>
                <AlertCircle size={28} />
              </div>
              <h3 className="fb-modal-title" style={{ fontSize: '20px' }}>Google Login Required</h3>
              <p className="fb-modal-sub" style={{ margin: 0 }}>
                To {authReason}, you must be logged in with a Google account to prevent spam and verify your identity.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '12px' }}>
                <Btn onClick={() => router.push('/login?redirectTo=/feedback')}>
                  <LogIn size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  Log in with Google
                </Btn>
                <Btn variant="secondary" onClick={() => setShowAuthModal(false)}>Cancel</Btn>
              </div>
            </div>
          </div>
        </React.Fragment>
      )}

      {toast && <div className="fb-toast">{toast}</div>}
    </div>
  );
}
