"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext, Pack } from '@/context/GameContext';
import { Logo, Btn, Coin } from '@/components/components';
import { auth, isFirebaseEnabled } from '@/firebase/config';

const ADMIN_TOKEN_SECRET = "admin-secret-token-123";

const SPACE_PACK_SAMPLE = {
  "packs": [
    {
      "name": "Space & Cosmos",
      "free": false,
      "price": 150,
      "prompts": [
        "Houston, we have a problem: ____.",
        "One giant leap for ____.",
        "The latest NASA discovery: signs of ____ on Mars."
      ],
      "answers": [
        "tangy space ice cream",
        "a zero-gravity high five",
        "accidentally venting the airlock",
        "an alien fleet disguised as Starlink satellites",
        "dehydrated astronaut tacos",
        "space dust"
      ]
    }
  ]
};

const TECH_PACK_SAMPLE = {
  "packs": [
    {
      "name": "Tech & Startups",
      "free": false,
      "price": 120,
      "prompts": [
        "Step 1: ____. Step 2: profit.",
        "Our new pitch deck highlights our core competency: ____.",
        "The latest unicorn is built entirely on ____.",
        "We are pivoting our AI startup to focus on ____."
      ],
      "answers": [
        "the neighbor's wifi",
        "homemade kombucha",
        "pivoting to web3",
        "running out of VC funding",
        "an AI wrapper of a Google Sheet",
        "sleeping under your desk",
        "a failed product demo",
        "over-engineering a basic form"
      ]
    }
  ]
};
export default function AdminPage() {
  const router = useRouter();
  const { isHydrated, packs, account, logout } = useGameContext();
  const [jsonText, setJsonText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [firestorePacks, setFirestorePacks] = useState<any[]>([]);

  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isSubmittingBE, setIsSubmittingBE] = useState(false);

  const [purchases, setPurchases] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'analytics' | 'rooms' | 'catalog'>('analytics');
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'top-up' | 'spend'>('all');

  // Load Firestore packs in real-time
  useEffect(() => {
    if (!isHydrated) return;
    let unsub: (() => void) | null = null;
    import('@/firebase/firestore').then(({ subscribePackages }) => {
      unsub = subscribePackages((pkgs) => setFirestorePacks(pkgs));
    });
    return () => { if (unsub) unsub(); };
  }, [isHydrated]);

  // Load purchases, users & rooms in real-time
  useEffect(() => {
    if (!isHydrated || !account || !account.admin) return;
    
    let isSubscribed = true;
    let unsubAuth: (() => void) | null = null;

    const fetchAnalytics = () => {
      import('@/firebase/firestore').then(({ getPurchases, getAllUsers, getAllRooms }) => {
        if (!isSubscribed) return;
        Promise.all([getPurchases(), getAllUsers(), getAllRooms()]).then(([purchRes, userRes, roomRes]) => {
          if (!isSubscribed) return;
          const safePurch = Array.isArray(purchRes) ? purchRes : [];
          const safeUsers = Array.isArray(userRes) ? userRes : [];
          const safeRooms = Array.isArray(roomRes) ? roomRes : [];
          safePurch.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
          setPurchases(safePurch);
          setUsers(safeUsers);
          setRooms(safeRooms);
        }).catch(err => console.error("fetchAnalytics failed", err));
      });
    };

    if (isFirebaseEnabled && auth) {
      if (!auth.currentUser || auth.currentUser.uid !== account.uid) {
        unsubAuth = auth.onAuthStateChanged((user) => {
          if (user && user.uid === account.uid) {
            fetchAnalytics();
          }
        });
      } else {
        fetchAnalytics();
      }
    } else {
      fetchAnalytics();
    }

    return () => {
      isSubscribed = false;
      if (unsubAuth) unsubAuth();
    };
  }, [isHydrated, account, importSuccess, migrationLog]);

  const adminKeys = useMemo(() => {
    const uids = new Set<string>();
    const emails = new Set<string>(["sidhanshumonga28@gmail.com"]);
    if (Array.isArray(users)) {
      users.forEach(u => {
        if (u && u.admin) {
          if (u.uid) uids.add(u.uid);
          if (u.email && typeof u.email === 'string') {
            emails.add(u.email.toLowerCase());
          }
        }
      });
    }
    return { uids, emails };
  }, [users]);

  const filteredPurchases = useMemo(() => {
    if (!Array.isArray(purchases)) return [];
    return purchases.filter(p => {
      if (!p) return false;
      const emailLower = p.userEmail && typeof p.userEmail === 'string' ? p.userEmail.toLowerCase() : "";
      const isFromAdmin = adminKeys.uids.has(p.userId) || adminKeys.emails.has(emailLower);
      return !isFromAdmin;
    });
  }, [purchases, adminKeys]);

  const stats = useMemo(() => {
    let usdRevenue = 0;
    let inrRevenue = 0;
    let coinsBought = 0;
    let coinsSpent = 0;
    let packsSpentCount = 0;
    let upgradesSpentCount = 0;

    if (Array.isArray(filteredPurchases)) {
      filteredPurchases.forEach((p) => {
        if (!p) return;
        if (p.type === 'top-up') {
          coinsBought += p.coinsAwarded || 0;
          if (p.currency === 'USD') usdRevenue += p.cost || 0;
          if (p.currency === 'INR') inrRevenue += p.cost || 0;
        } else if (p.type === 'spend') {
          coinsSpent += p.cost || 0;
          if (p.itemType === 'pack') packsSpentCount++;
          if (p.itemType === 'upgrade') upgradesSpentCount++;
        }
      });
    }

    return { usdRevenue, inrRevenue, coinsBought, coinsSpent, packsSpentCount, upgradesSpentCount };
  }, [filteredPurchases]);

  const processedTransactions = useMemo(() => {
    let result = filteredPurchases;
    
    // 1. Filter by type
    if (filterType !== 'all') {
      result = result.filter(p => p.type === filterType);
    }
    
    // 2. Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => {
        const email = p.userEmail && typeof p.userEmail === 'string' ? p.userEmail.toLowerCase() : "";
        const name = p.itemName && typeof p.itemName === 'string' ? p.itemName.toLowerCase() : "";
        const uid = p.userId && typeof p.userId === 'string' ? p.userId.toLowerCase() : "";
        return email.includes(q) || name.includes(q) || uid.includes(q);
      });
    }
    
    return result;
  }, [filteredPurchases, filterType, searchQuery]);

  const userStats = useMemo(() => {
    let totalUsers = 0;
    let activeUsers = 0;
    let guestUsers = 0;
    let totalAdmin = 0;
    
    if (Array.isArray(users)) {
      totalUsers = users.length;
      users.forEach(u => {
        if (!u) return;
        if (u.admin) totalAdmin++;
        if (u.guest) guestUsers++;
        if (u.games && u.games > 0) activeUsers++;
      });
    }
    
    return { totalUsers, activeUsers, guestUsers, totalAdmin };
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter(u => {
      if (!u) return false;
      const email = u.email && typeof u.email === 'string' ? u.email.toLowerCase() : "";
      const name = u.name && typeof u.name === 'string' ? u.name.toLowerCase() : "";
      const uid = u.uid && typeof u.uid === 'string' ? u.uid.toLowerCase() : "";
      return email.includes(q) || name.includes(q) || uid.includes(q);
    });
  }, [users, searchQuery]);

  const roomStats = useMemo(() => {
    let totalRooms = 0;
    let inLobbyDisconnected = 0;
    let inLobbyActive = 0;
    let activeGames = 0;
    let completedGames = 0;
    let endedGames = 0;
    
    const packUsage: { [key: string]: number } = {};
    const oneHourAgo = Date.now() - 3600000;

    if (Array.isArray(rooms)) {
      totalRooms = rooms.length;
      rooms.forEach((r) => {
        if (!r) return;
        
        let createdMs = 0;
        if (r.createdAt) {
          if (typeof r.createdAt.toMillis === 'function') {
            createdMs = r.createdAt.toMillis();
          } else if (r.createdAt.seconds) {
            createdMs = r.createdAt.seconds * 1000;
          } else if (typeof r.createdAt === 'number') {
            createdMs = r.createdAt;
          }
        }

        if (r.status === 'lobby') {
          if (createdMs && createdMs < oneHourAgo) {
            inLobbyDisconnected++;
          } else {
            inLobbyActive++;
          }
        } else if (r.status === 'playing') {
          activeGames++;
        } else if (r.status === 'completed') {
          completedGames++;
        } else if (r.status === 'ended') {
          endedGames++;
        }

        if (r.settings && Array.isArray(r.settings.packs)) {
          r.settings.packs.forEach((pId: string) => {
            packUsage[pId] = (packUsage[pId] || 0) + 1;
          });
        }
      });
    }

    const sortedPackUsage = Object.entries(packUsage)
      .map(([packId, count]) => {
        const match = (packs || []).find((pk) => pk.id === packId) || (firestorePacks || []).find((pk) => pk.id === packId);
        return {
          id: packId,
          name: match ? match.name : packId,
          count
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      totalRooms,
      inLobbyDisconnected,
      inLobbyActive,
      activeGames,
      completedGames,
      endedGames,
      sortedPackUsage
    };
  }, [rooms, packs, firestorePacks]);

  const handleMigratePurchases = async () => {
    setIsMigrating(true);
    setMigrationLog("Starting transaction scan...");
    try {
      const { migrateExistingPurchases } = await import('@/firebase/firestore');
      const count = await migrateExistingPurchases();
      setMigrationLog(`Sync completed. Successfully migrated ${count} legacy user transactions to /purchases.`);
      setTimeout(() => setMigrationLog(null), 5000);
    } catch (e: any) {
      setMigrationLog(`Sync failed: ${e.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const loadPreset = (preset: object) => {
    setJsonText(JSON.stringify(preset, null, 2));
    setValidationError(null);
    setImportSuccess(null);
  };

  // Live validation
  useEffect(() => {
    if (!jsonText.trim()) {
      setValidationError(null);
      return;
    }
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.packs || !Array.isArray(parsed.packs)) {
        setValidationError("Root object must contain a 'packs' array.");
        return;
      }
      for (let i = 0; i < parsed.packs.length; i++) {
        const p = parsed.packs[i];
        if (!p.name || typeof p.name !== "string") {
          setValidationError(`Pack index ${i} is missing a string property 'name'.`);
          return;
        }
        if (p.free === undefined) {
          setValidationError(`Pack '${p.name}' is missing property 'free' (boolean).`);
          return;
        }
        if (!p.free && (p.price === undefined || typeof p.price !== "number")) {
          setValidationError(`Pack '${p.name}' is premium but missing a numerical 'price'.`);
          return;
        }
        if (p.prompts && !Array.isArray(p.prompts)) {
          setValidationError(`Pack '${p.name}' prompts must be an array of strings.`);
          return;
        }
        if (p.answers && !Array.isArray(p.answers)) {
          setValidationError(`Pack '${p.name}' answers must be an array of strings.`);
          return;
        }
      }
      setValidationError(null);
    } catch (e: any) {
      setValidationError(`Invalid JSON syntax: ${e.message}`);
    }
  }, [jsonText]);

  const handleSeedFirestore = async () => {
    if (validationError || !jsonText.trim() || isSubmittingBE || !account) return;
    setIsSubmittingBE(true);
    setTerminalLogs([]);
    const log = (msg: string) => setTerminalLogs(prev => [...prev, msg]);
    const adminUid = account.uid || account.email;
    log(`[${new Date().toISOString()}] SEEDING FIRESTORE DATABASE...`);

    try {
      const parsed = JSON.parse(jsonText);
      const { seedPackage } = await import('@/firebase/firestore');
      let seeded = 0;
      for (const pack of parsed.packs) {
        log(`> Seeding pack: "${pack.name}" (${pack.prompts?.length || 0} prompts, ${pack.answers?.length || 0} answers)`);
        const packId = await seedPackage({
          ...pack,
          cards: (pack.prompts?.length || 0) + (pack.answers?.length || 0),
        }, adminUid);
        if (packId) {
          log(`  ✓ Seeded as packages/${packId}`);
          seeded++;
        } else {
          log(`  ✗ Failed to seed "${pack.name}"`);
        }
      }
      log(`> `);
      log(`[SYSTEM] ✓ ${seeded}/${parsed.packs.length} pack(s) seeded to Firestore successfully.`);
      setImportSuccess(`${seeded} pack(s) saved to Firestore and available to all users.`);
      setTimeout(() => setImportSuccess(null), 5000);
    } catch (err: any) {
      log(`[ERROR] Firestore write failed: ${err.message}`);
    } finally {
      setIsSubmittingBE(false);
    }
  };

  const handleClearFirestore = async () => {
    if (!confirm("Delete ALL seeded packages from Firestore? This affects all users.")) return;
    const { deletePackage } = await import('@/firebase/firestore');
    const log = (msg: string) => setTerminalLogs(prev => [...prev, msg]);
    setTerminalLogs([]);
    log(`[${new Date().toISOString()}] CLEARING FIRESTORE PACKAGES...`);
    for (const pack of firestorePacks) {
      await deletePackage(pack.id);
      log(`  ✓ Deleted packages/${pack.id}`);
    }
    log(`[SYSTEM] All packages cleared.`);
  };

  const handleSignOut = () => {
    logout();
    router.push('/');
  };

  if (!isHydrated) {
    return (
      <div className="screen center-screen">
        <div className="waiting-text">Loading configuration...</div>
      </div>
    );
  }

  // --- ACCESS CONTROL AUTHORIZATION GATES ---
  if (!account) {
    return (
      <div className="screen center-screen admin-gate-screen">
        <div className="admin-gate-card">
          <div className="admin-gate-icon">🔒</div>
          <h1 className="admin-gate-title">Admin Console</h1>
          <p className="admin-gate-desc">Administrator access restricted. Please log in with Google to authenticate.</p>
          <div className="admin-gate-form">
            <button className="btn primary btn-big admin-gate-btn" onClick={() => router.push('/login')}>
              Log in with Google
            </button>
          </div>
          <button className="linkbtn admin-gate-back" onClick={() => router.push('/')}>
            ← Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (!account.admin) {
    return (
      <div className="screen center-screen admin-gate-screen">
        <div className="admin-gate-card admin-denied-card">
          <div className="admin-gate-icon">🚫</div>
          <h1 className="admin-gate-title text-red">Access Denied</h1>
          <p className="admin-gate-desc">
            Your account <b>{account.email}</b> does not have administrator privileges. Please request access or switch accounts.
          </p>
          <div className="admin-gate-form">
            <button className="btn primary btn-big admin-gate-btn" onClick={() => router.push('/login')}>
              Switch Accounts
            </button>
          </div>
          <button className="linkbtn admin-gate-back" onClick={() => router.push('/')}>
            ← Return to Home
          </button>
        </div>
      </div>
    );
  }

  // --- AUTHORIZED ADMIN PANEL ---
  return (
    <div className="screen create-screen admin-screen" data-screen-label="Admin Console">
      <header className="create-head">
        <button className="iconbtn create-back" onClick={() => router.push('/')} aria-label="Back">←</button>
        <Logo />
        <span className="store-balance">
          <button className="linkbtn" onClick={handleSignOut}>Log Out</button>
        </span>
      </header>

      <div className="create-body admin-layout">
        <div className="admin-header-row">
          <h2 className="create-title admin-title">Admin Console</h2>
          <span className="chip admin-secure-badge">● Secure Admin Session</span>
        </div>

        {/* Tab Navigation */}
        <div className="admin-tabs">
          <button 
            className={`admin-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Purchase Analytics
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
            onClick={() => setActiveTab('rooms')}
          >
            Room & Session Analytics
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'catalog' ? 'active' : ''}`}
            onClick={() => setActiveTab('catalog')}
          >
            Manage Packs & Catalog
          </button>
        </div>

        {activeTab === 'analytics' ? (
          /* ======================================================================
             TAB 1: PURCHASE ANALYTICS (BIGGER & BETTER VIEW)
             ====================================================================== */
          <div className="analytics-layout">
            {/* Stats Summary Grid (6 cards) */}
            <div className="premium-stats-row">
              <div className="premium-stat-card stat-card-usd">
                <span className="premium-stat-value">${stats.usdRevenue.toFixed(2)}</span>
                <span className="premium-stat-label">USD Revenue</span>
              </div>
              <div className="premium-stat-card stat-card-inr">
                <span className="premium-stat-value">₹{stats.inrRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                <span className="premium-stat-label">INR Revenue</span>
              </div>
              <div className="premium-stat-card stat-card-bought">
                <span className="premium-stat-value">{stats.coinsBought.toLocaleString()}</span>
                <span className="premium-stat-label">Coins Purchased</span>
              </div>
              <div className="premium-stat-card stat-card-spent">
                <span className="premium-stat-value">{stats.coinsSpent.toLocaleString()}</span>
                <span className="premium-stat-label">Coins Spent</span>
              </div>
              <div className="premium-stat-card stat-card-packs">
                <span className="premium-stat-value">{stats.packsSpentCount}</span>
                <span className="premium-stat-label">Packs Unlocked</span>
              </div>
              <div className="premium-stat-card stat-card-upgrades">
                <span className="premium-stat-value">{stats.upgradesSpentCount}</span>
                <span className="premium-stat-label">Upgrades Unlocked</span>
              </div>
            </div>

            {/* Filter and Search Controls */}
            <div className="analytics-controls">
              <div className="search-input-wrap">
                <input 
                  type="text" 
                  className="search-input"
                  placeholder="Search transactions or users by email/name/UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="filter-tabs">
                <button 
                  className={`filter-tab-btn ${filterType === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  All Transactions
                </button>
                <button 
                  className={`filter-tab-btn ${filterType === 'top-up' ? 'active' : ''}`}
                  onClick={() => setFilterType('top-up')}
                >
                  Coin Top-ups
                </button>
                <button 
                  className={`filter-tab-btn ${filterType === 'spend' ? 'active' : ''}`}
                  onClick={() => setFilterType('spend')}
                >
                  Coin Spends
                </button>
              </div>

              <button 
                className="preset-btn" 
                disabled={isMigrating} 
                onClick={handleMigratePurchases}
                style={{ margin: 0, padding: '10px 16px', fontSize: '13px' }}
              >
                {isMigrating ? "Syncing..." : "🔄 Sync Stripe Purchases"}
              </button>
            </div>

            {migrationLog && (
              <div className="validation-bar validation-success" style={{ fontSize: '13.5px' }}>
                {migrationLog}
              </div>
            )}

            {/* Two-Column Grid: Transactions (Left) & Players List (Right) */}
            <div className="analytics-grid">
              
              {/* Column 1: Recent Transactions */}
              <section className="analytics-table-card" style={{ marginBottom: 0 }}>
                <div className="table-header-row">
                  <h3 className="table-title">Transaction History ({processedTransactions.length})</h3>
                </div>
                
                <div className="premium-table-wrap">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>User Email</th>
                        <th>Type</th>
                        <th>Item Description</th>
                        <th>Price/Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
                            No transaction records matched the filters.
                          </td>
                        </tr>
                      ) : (
                        processedTransactions.map((p, idx) => {
                          const dateObj = p.timestamp ? new Date(p.timestamp) : null;
                          const dateStr = dateObj 
                            ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + 
                              ' ' + 
                              dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                            : 'Unknown Date';
                            
                          return (
                            <tr key={p.id || idx}>
                              <td style={{ opacity: 0.8, fontSize: '12.5px' }}>{dateStr}</td>
                              <td style={{ fontWeight: 500 }}>
                                <span title={p.userId}>{p.userEmail || "anonymous"}</span>
                              </td>
                              <td>
                                <span className={p.type === 'top-up' ? 'badge-top-up' : 'badge-spend'}>
                                  {p.type === 'top-up' ? 'Top-up' : 'Spend'}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{p.itemName || "Unnamed Item"}</td>
                              <td style={{ fontWeight: 700 }}>
                                {p.currency === 'coins' ? (
                                  <span style={{ color: '#FFC93C' }}>{p.cost} coins</span>
                                ) : p.currency === 'USD' ? (
                                  <span style={{ color: '#2BC4BE' }}>${p.cost.toFixed(2)}</span>
                                ) : (
                                  <span style={{ color: '#00D2FF' }}>₹{p.cost.toFixed(0)}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Column 2: Players Summary List */}
              <section className="analytics-table-card" style={{ marginBottom: 0 }}>
                <div className="table-header-row">
                  <h3 className="table-title">Registered Players ({filteredUsers.length})</h3>
                </div>

                <div className="premium-table-wrap" style={{ maxHeight: '450px' }}>
                  {filteredUsers.length === 0 ? (
                    <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
                      No registered players found.
                    </p>
                  ) : (
                    filteredUsers.map((u, idx) => {
                      const firstLetter = u.name ? u.name.charAt(0) : (u.email ? u.email.charAt(0) : '?');
                      const userRole = u.admin ? 'Admin' : (u.guest ? 'Guest' : 'Player');
                      const roleClass = u.admin ? 'badge-admin' : (u.guest ? 'badge-guest' : 'badge-player');
                      
                      return (
                        <div key={u.uid || idx} className="player-user-row">
                          <div 
                            className="player-avatar" 
                            style={{ background: u.color || '#5c6bc0' }}
                          >
                            {firstLetter}
                          </div>
                          
                          <div className="player-info">
                            <div className="player-name">
                              <span>{u.name || "Anonymous User"}</span>
                              <span className={roleClass}>{userRole}</span>
                            </div>
                            <div className="player-email" title={u.uid}>{u.email || "No email address"}</div>
                          </div>
                          
                          <div className="player-meta">
                            <span className="player-coins">{u.credits ?? 0} coins</span>
                            <span className="player-games">{u.games ?? 0} games</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

            </div>
          </div>
        ) : activeTab === 'rooms' ? (
          /* ======================================================================
             TAB 2: ROOM & SESSION ANALYTICS
             ====================================================================== */
          <div className="analytics-layout animate-fade-in">
            {/* Stats Summary Grid (6 cards) */}
            <div className="premium-stats-row">
              <div className="premium-stat-card stat-card-usd">
                <span className="premium-stat-value">{roomStats.totalRooms}</span>
                <span className="premium-stat-label">Total Rooms Created</span>
              </div>
              <div className="premium-stat-card stat-card-bought">
                <span className="premium-stat-value">{roomStats.inLobbyActive}</span>
                <span className="premium-stat-label">Active Lobbies</span>
              </div>
              <div className="premium-stat-card stat-card-spent">
                <span className="premium-stat-value">{roomStats.inLobbyDisconnected}</span>
                <span className="premium-stat-label">Abandoned Lobbies (&gt;1h)</span>
              </div>
              <div className="premium-stat-card stat-card-inr">
                <span className="premium-stat-value">{roomStats.activeGames}</span>
                <span className="premium-stat-label">Active Games (Playing)</span>
              </div>
              <div className="premium-stat-card stat-card-packs">
                <span className="premium-stat-value">{roomStats.completedGames}</span>
                <span className="premium-stat-label">Completed Games</span>
              </div>
              <div className="premium-stat-card stat-card-upgrades">
                <span className="premium-stat-value">{roomStats.endedGames}</span>
                <span className="premium-stat-label">Host-Ended Games</span>
              </div>
            </div>

            {/* Room Analytics Grid */}
            <div className="analytics-grid">
              
              {/* Column 1: Detailed Room Sessions Log */}
              <section className="analytics-table-card" style={{ marginBottom: 0 }}>
                <div className="table-header-row">
                  <h3 className="table-title">Active & Historic Room Sessions ({rooms.length})</h3>
                </div>
                
                <div className="premium-table-wrap">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Room Code</th>
                        <th>Host Name</th>
                        <th>Created Date</th>
                        <th>Status</th>
                        <th>Details (Max Players / Timer)</th>
                        <th>Packs Selected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
                            No game rooms created in the database yet.
                          </td>
                        </tr>
                      ) : (
                        [...rooms]
                          .sort((a, b) => {
                            const aTs = a.createdAt?.seconds || 0;
                            const bTs = b.createdAt?.seconds || 0;
                            return bTs - aTs;
                          })
                          .map((r, idx) => {
                            let dateStr = 'Unknown';
                            if (r.createdAt) {
                              const dateObj = typeof r.createdAt.toMillis === 'function' 
                                ? new Date(r.createdAt.toMillis()) 
                                : new Date((r.createdAt.seconds || 0) * 1000);
                              dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            }
                            
                            let badgeClass = 'badge-guest';
                            if (r.status === 'playing') badgeClass = 'badge-player';
                            if (r.status === 'completed') badgeClass = 'badge-top-up';
                            if (r.status === 'ended') badgeClass = 'badge-spend';
                            
                            const isAbandoned = r.status === 'lobby' && 
                              r.createdAt && 
                              (typeof r.createdAt.toMillis === 'function' ? r.createdAt.toMillis() : (r.createdAt.seconds || 0) * 1000) < Date.now() - 3600000;
                              
                            return (
                              <tr key={r.code || idx}>
                                <td style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '15px', color: 'var(--accent2)' }}>{r.code}</td>
                                <td style={{ fontWeight: 600 }}>{r.hostName || 'Anonymous'}</td>
                                <td style={{ opacity: 0.7, fontSize: '12.5px' }}>{dateStr}</td>
                                <td>
                                  {isAbandoned ? (
                                    <span className="badge-spend">Abandoned</span>
                                  ) : (
                                    <span className={badgeClass}>{r.status}</span>
                                  )}
                                </td>
                                <td>
                                  {r.settings ? (
                                    <span style={{ fontSize: '12.5px' }}>
                                      👤 Max: {r.settings.maxPlayers || 8} | ⏱️ {r.settings.timer || 30}s
                                    </span>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                                <td>
                                  {r.settings && Array.isArray(r.settings.packs) ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                      {r.settings.packs.map((pId: string) => {
                                        const pName = (packs || []).find(pk => pk.id === pId)?.name || pId;
                                        return (
                                          <span 
                                            key={pId} 
                                            className="custom-badge" 
                                            style={{ 
                                              background: 'rgba(255,255,255,0.06)', 
                                              color: 'rgba(255,255,255,0.7)',
                                              fontSize: '10px',
                                              padding: '1px 5px',
                                              borderRadius: '3px'
                                            }}
                                          >
                                            {pName}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="muted">None</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Column 2: Package Popularity Ranking */}
              <section className="analytics-table-card" style={{ marginBottom: 0 }}>
                <div className="table-header-row">
                  <h3 className="table-title">Most Popular Packs in Rooms</h3>
                </div>
                
                <div className="premium-table-wrap">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Rank</th>
                        <th>Package Name</th>
                        <th style={{ textAlign: 'right' }}>Rooms Enabled In</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomStats.sortedPackUsage.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
                            No card package usage recorded yet.
                          </td>
                        </tr>
                      ) : (
                        roomStats.sortedPackUsage.map((p, idx) => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 800, color: 'var(--accent2)' }}>#{idx + 1}</td>
                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#00d2ff' }}>
                              {p.count} room{p.count === 1 ? '' : 's'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

            </div>
          </div>
        ) : (
          /* ======================================================================
             TAB 2: MANAGE PACKS & CATALOG
             ====================================================================== */
          <div className="admin-grid">
            {/* Column 1: JSON Editor */}
            <section className="admin-panel admin-panel-editor">
              <div className="admin-panel-head">
                <h3>Import Card Packages</h3>
                <span className="admin-panel-subtitle">Seed package lists directly into game database</span>
              </div>

              <div className="preset-row">
                <span className="preset-label">Load Preset:</span>
                <button className="preset-btn" onClick={() => loadPreset(SPACE_PACK_SAMPLE)}>Space & Cosmos Pack</button>
                <button className="preset-btn" onClick={() => loadPreset(TECH_PACK_SAMPLE)}>Tech & Startups Pack</button>
              </div>

              <div className="editor-wrap">
                <textarea
                  className={`admin-textarea ${validationError ? 'editor-err' : jsonText.trim() ? 'editor-success' : ''}`}
                  placeholder={`{\n  "packs": [\n    {\n      "name": "Astronomy Pack",\n      "free": false,\n      "price": 100,\n      "prompts": ["I looked into space and saw ____."],\n      "answers": ["twinkle stars"]\n    }\n  ]\n}`}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                />
                {validationError && (
                  <div className="validation-bar validation-err">
                    ✕ {validationError}
                  </div>
                )}
                {!validationError && jsonText.trim() && (
                  <div className="validation-bar validation-success">
                    ✓ Valid JSON Schema Structure
                  </div>
                )}
              </div>

              {importSuccess && (
                <div className="import-success-toast">
                  {importSuccess}
                </div>
              )}

              <div className="admin-actions">
                <Btn
                  big={true}
                  variant="primary"
                  disabled={!!validationError || !jsonText.trim() || isSubmittingBE}
                  onClick={handleSeedFirestore}
                >
                  {isSubmittingBE ? "Seeding Firestore..." : "Seed to Firestore DB"}
                </Btn>
              </div>
            </section>

            {/* Column 2: Catalog Status & Logs */}
            <div className="admin-col-right">
              {/* Database Status Panel */}
              <section className="admin-panel admin-panel-status">
                <div className="admin-panel-head">
                  <h3>Card Catalog Status</h3>
                </div>
                
                <div className="status-grid">
                  <div className="status-item">
                    <span className="status-num">{packs.length}</span>
                    <span className="status-label">Total Packs</span>
                  </div>
                  <div className="status-item">
                    <span className="status-num">{firestorePacks.length}</span>
                    <span className="status-label">🔥 In Firestore</span>
                  </div>
                </div>

                <div className="catalog-list-wrap">
                  <h4 className="catalog-list-title">Firestore Packages ({firestorePacks.length}):</h4>
                  <div className="catalog-list">
                    {firestorePacks.length === 0 && <p className="muted" style={{padding:'8px 0'}}>No packages seeded yet.</p>}
                    {firestorePacks.map((p) => (
                      <div key={p.id} className="catalog-item">
                        <div className="catalog-item-main">
                          <span className="catalog-item-name">{p.name}</span>
                          <span className="custom-badge" style={{background:'rgba(44,196,190,0.15)',color:'#2BC4BE'}}>Firestore</span>
                        </div>
                        <div className="catalog-item-meta">
                          <span className="catalog-item-cards">{p.cards} cards</span>
                          {p.free ? (
                            <span className="catalog-item-price">Free</span>
                          ) : (
                            <span className="catalog-item-price"><Coin size={10} /> {p.price}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {firestorePacks.length > 0 && (
                  <button className="clear-db-btn" onClick={handleClearFirestore}>
                    ✕ Wipe All Firestore Packages
                  </button>
                )}
              </section>

              {/* Console terminal */}
              {terminalLogs.length > 0 && (
                <section className="admin-panel admin-panel-terminal" style={{ marginTop: '20px' }}>
                  <div className="admin-panel-head">
                    <h3>Backend API Console Output</h3>
                  </div>
                  <div className="terminal-screen">
                    {terminalLogs.map((line, index) => (
                      <div
                        key={index}
                        className={
                          line.startsWith("<") ? "term-in" :
                          line.startsWith("[ERROR]") ? "term-err" :
                          line.startsWith("[SYSTEM]") ? "term-sys" :
                          line.startsWith(">") ? "term-out" :
                          "term-text"
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
