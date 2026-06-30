"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext, Pack } from '@/context/GameContext';
import { Logo, Btn, Coin } from '@/components/components';
import { auth, isFirebaseEnabled } from '@/firebase/config';
import { ChevronLeft } from 'lucide-react';

const ADMIN_TOKEN_SECRET = "admin-secret-token-123";

const SPACE_PACK_SAMPLE = {
  "packs": [
    {
      "name": "Space & Cosmos",
      "free": false,
      "price": 200,
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
      "price": 180,
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
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [playersAcrossRooms, setPlayersAcrossRooms] = useState<any[]>([]);
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

  // Load purchases, users, rooms & feedbacks in real-time
  useEffect(() => {
    if (!isHydrated || !account || !account.admin) return;
    
    let isSubscribed = true;
    let unsubAuth: (() => void) | null = null;

    const fetchAnalytics = () => {
      import('@/firebase/firestore').then(({ getPurchases, getAllUsers, getAllRooms, getFeedbacks, getAllPlayersAcrossRooms }) => {
        if (!isSubscribed) return;
        Promise.all([getPurchases(), getAllUsers(), getAllRooms(), getFeedbacks(), getAllPlayersAcrossRooms()]).then(([purchRes, userRes, roomRes, feedRes, playersRes]) => {
          if (!isSubscribed) return;
          const safePurch = Array.isArray(purchRes) ? purchRes : [];
          const safeUsers = Array.isArray(userRes) ? userRes : [];
          const safeRooms = Array.isArray(roomRes) ? roomRes : [];
          const safeFeed = Array.isArray(feedRes) ? feedRes : [];
          const safePlayers = Array.isArray(playersRes) ? playersRes : [];
          safePurch.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
          setPurchases(safePurch);
          setUsers(safeUsers);
          setRooms(safeRooms);
          setFeedbacks(safeFeed);
          setPlayersAcrossRooms(safePlayers);
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
    let gbpRevenue = 0;
    let coinsBought = 0;
    let coinsSpent = 0;
    let packsSpentCount = 0;
    let upgradesSpentCount = 0;

    if (Array.isArray(filteredPurchases)) {
      filteredPurchases.forEach((p) => {
        if (!p) return;
        if (p.type === 'top-up') {
          coinsBought += p.coinsAwarded || 0;
          const cur = p.currency ? p.currency.toUpperCase() : '';
          if (cur === 'USD') usdRevenue += p.cost || 0;
          else if (cur === 'INR') inrRevenue += p.cost || 0;
          else if (cur === 'GBP') gbpRevenue += p.cost || 0;
        } else if (p.type === 'spend') {
          coinsSpent += p.cost || 0;
          if (p.itemType === 'pack') packsSpentCount++;
          if (p.itemType === 'upgrade') upgradesSpentCount++;
        }
      });
    }

    return { usdRevenue, inrRevenue, gbpRevenue, coinsBought, coinsSpent, packsSpentCount, upgradesSpentCount };
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

    const sortedUsers = [...users].sort((a, b) => {
      const aTime = a.createdAt
        ? (typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime()))
        : 0;
      const bTime = b.createdAt
        ? (typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime()))
        : 0;
      return bTime - aTime;
    });

    if (!searchQuery.trim()) return sortedUsers;
    const q = searchQuery.toLowerCase().trim();
    return sortedUsers.filter(u => {
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
  }, [rooms]);

  const platformStats = useMemo(() => {
    let createdDesktop = 0;
    let createdMobile = 0;
    let createdUnknown = 0;

    let startedDesktop = 0;
    let startedMobile = 0;
    let startedUnknown = 0;

    let playingDesktopHost = 0;
    let playingMobileHost = 0;
    let playingUnknownHost = 0;

    let activePlayersDesktop = 0;
    let activePlayersMobile = 0;
    let activePlayersBot = 0;

    let totalPlayersDesktop = 0;
    let totalPlayersMobile = 0;
    let totalPlayersBot = 0;

    if (Array.isArray(rooms)) {
      rooms.forEach((r) => {
        if (!r) return;
        if (r.createdByPlatform === 'desktop') createdDesktop++;
        else if (r.createdByPlatform === 'mobile') createdMobile++;
        else createdUnknown++;

        if (r.startedByPlatform === 'desktop') startedDesktop++;
        else if (r.startedByPlatform === 'mobile') startedMobile++;
        else if (r.status === 'playing' || r.status === 'completed' || r.status === 'ended') {
          startedUnknown++;
        }

        if (r.status === 'playing') {
          if (r.createdByPlatform === 'desktop') playingDesktopHost++;
          else if (r.createdByPlatform === 'mobile') playingMobileHost++;
          else playingUnknownHost++;
        }
      });
    }

    if (Array.isArray(playersAcrossRooms)) {
      playersAcrossRooms.forEach((p) => {
        if (!p) return;
        const parentRoom = rooms.find((r) => r.code === p.roomCode);
        const isRoomPlaying = parentRoom?.status === 'playing';

        if (p.platform === 'desktop') {
          totalPlayersDesktop++;
          if (isRoomPlaying) activePlayersDesktop++;
        } else if (p.platform === 'mobile') {
          totalPlayersMobile++;
          if (isRoomPlaying) activePlayersMobile++;
        } else if (p.platform === 'bot' || p.isBot) {
          totalPlayersBot++;
          if (isRoomPlaying) activePlayersBot++;
        }
      });
    }

    return {
      createdDesktop,
      createdMobile,
      createdUnknown,
      startedDesktop,
      startedMobile,
      startedUnknown,
      playingDesktopHost,
      playingMobileHost,
      playingUnknownHost,
      activePlayersDesktop,
      activePlayersMobile,
      activePlayersBot,
      totalPlayersDesktop,
      totalPlayersMobile,
      totalPlayersBot,
    };
  }, [rooms, playersAcrossRooms]);

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

  const handleDeletePack = async (packId: string) => {
    const pack = firestorePacks.find(p => p.id === packId);
    const packName = pack ? pack.name : packId;
    if (!confirm(`Are you sure you want to delete the package "${packName}"? This action cannot be undone.`)) return;
    try {
      const { deletePackage } = await import('@/firebase/firestore');
      await deletePackage(packId);
      alert(`Package "${packName}" successfully deleted.`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to delete package: ${err.message}`);
    }
  };

  const handleDeleteRoom = async (code: string) => {
    if (!confirm(`Are you sure you want to delete room session "${code}"? All active state for this game will be wiped.`)) return;
    try {
      const { deleteRoom } = await import('@/firebase/firestore');
      await deleteRoom(code);
      alert(`Room session "${code}" successfully deleted.`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to delete room: ${err.message}`);
    }
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
        <button className="iconbtn create-back" onClick={() => router.push('/')} aria-label="Back">
          <ChevronLeft size={20} />
        </button>
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
              <div className="premium-stat-card stat-card-gbp">
                <span className="premium-stat-value">£{stats.gbpRevenue.toFixed(2)}</span>
                <span className="premium-stat-label">GBP Revenue</span>
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

            {/* Stacked Layout: Transactions, Players Directory, User Feedback (Full Width) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%' }}>
              
              {/* Detailed Transaction History (Full Width) */}
              <section className="analytics-table-card" style={{ marginBottom: 0 }}>
                <div className="table-header-row">
                  <h3 className="table-title">Transaction History ({processedTransactions.length})</h3>
                </div>
                
                <div className="premium-table-wrap">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>User Email</th>
                        <th>User UID</th>
                        <th>Transaction Type</th>
                        <th>Item Description</th>
                        <th>Price/Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
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
                              <td style={{ fontWeight: 600 }}>{p.userEmail || "anonymous"}</td>
                              <td style={{ fontFamily: 'monospace', opacity: 0.5, fontSize: '11px' }}>{p.userId || "—"}</td>
                              <td>
                                {p.type === 'top-up' ? (
                                  <span className="custom-badge" style={{ background: 'rgba(43,196,190,0.15)', color: '#2bc4be', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>TOP-UP</span>
                                ) : (
                                  <span className="custom-badge" style={{ background: 'rgba(255,92,60,0.12)', color: '#ff5c3c', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>SPEND</span>
                                )}
                              </td>
                              <td style={{ fontWeight: 700 }}>{p.itemName || "Unnamed Item"}</td>
                              <td style={{ fontWeight: 800 }}>
                                {p.currency === 'coins' ? (
                                  <span style={{ color: '#FFC93C', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Coin size={12} /> {p.cost} coins
                                  </span>
                                ) : p.currency?.toUpperCase() === 'USD' ? (
                                  <span style={{ color: '#2BC4BE' }}>${p.cost.toFixed(2)} USD</span>
                                ) : p.currency?.toUpperCase() === 'GBP' ? (
                                  <span style={{ color: '#A855F7' }}>£{p.cost.toFixed(2)} GBP</span>
                                ) : (
                                  <span style={{ color: '#00D2FF' }}>₹{p.cost.toFixed(0)} INR</span>
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
                
              {/* Registered Players Card (Full Width) */}
              <section className="analytics-table-card" style={{ marginBottom: 0 }}>
                <div className="table-header-row">
                  <h3 className="table-title">Registered Players ({filteredUsers.length})</h3>
                </div>

                <div className="premium-table-wrap" style={{ maxHeight: '350px' }}>
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

              {/* User Feedback Card (Full Width) */}
              <section className="analytics-table-card" style={{ marginBottom: 0 }}>
                <div className="table-header-row">
                  <h3 className="table-title">User Feedback Ratings ({feedbacks.length})</h3>
                </div>

                <div className="premium-table-wrap" style={{ maxHeight: '350px' }}>
                  {feedbacks.length === 0 ? (
                    <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
                      No user feedback reports submitted yet.
                    </p>
                  ) : (
                    [...feedbacks]
                      .sort((a, b) => {
                        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return bTime - aTime;
                      })
                      .map((f, idx) => {
                        const stars = "★".repeat(f.rating || 0) + "☆".repeat(5 - (f.rating || 0));
                        const isLow = f.rating !== undefined && f.rating <= 2;
                        return (
                          <div key={f.id || idx} className="player-user-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                              <span style={{ color: isLow ? '#ff5c3c' : '#FFC93C', fontWeight: 800, letterSpacing: '2px', fontSize: '13px' }}>
                                {stars}
                              </span>
                              {f.createdAt && (
                                <span style={{ fontSize: '11px', opacity: 0.5 }}>
                                  {new Date(f.createdAt).toLocaleDateString()} {new Date(f.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            {f.comment && (
                              <p style={{ margin: '4px 0 0', fontSize: '13px', lineHeight: 1.45, color: '#e0e0e0', textWrap: 'pretty' }}>
                                "{f.comment}"
                              </p>
                            )}
                            {f.reasons && Array.isArray(f.reasons) && f.reasons.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                                {f.reasons.map((reason: string, rIdx: number) => (
                                  <span key={rIdx} style={{
                                    fontSize: '11px',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: 'rgba(255, 255, 255, 0.85)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    fontWeight: 600
                                  }}>
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            )}
                            {f.email && (
                              <span style={{ fontSize: '11px', opacity: 0.4, marginTop: '4px' }}>
                                By: {f.email}
                              </span>
                            )}
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

            {/* Platform Analytics Cards */}
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
                gap: '24px', 
                width: '100%', 
                marginTop: '28px',
                marginBottom: '28px' 
              }}
            >
              {/* Card 1: Game Creation & Starts */}
              <div className="analytics-table-card" style={{ padding: '24px', margin: 0 }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: 'var(--accent2)', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                  🎮 Game Sessions by Host Platform
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '12.5px', opacity: 0.6 }}>Total Created</span>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Desktop</span>
                        <strong style={{ fontSize: '16px', color: '#00d2ff' }}>{platformStats.createdDesktop}</strong>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Mobile</span>
                        <strong style={{ fontSize: '16px', color: 'var(--accent)' }}>{platformStats.createdMobile}</strong>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Legacy</span>
                        <strong style={{ fontSize: '16px', opacity: 0.7 }}>{platformStats.createdUnknown}</strong>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <span style={{ fontSize: '12.5px', opacity: 0.6 }}>Total Started</span>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Desktop</span>
                        <strong style={{ fontSize: '16px', color: '#00d2ff' }}>{platformStats.startedDesktop}</strong>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Mobile</span>
                        <strong style={{ fontSize: '16px', color: 'var(--accent)' }}>{platformStats.startedMobile}</strong>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Legacy</span>
                        <strong style={{ fontSize: '16px', opacity: 0.7 }}>{platformStats.startedUnknown}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Stuck Rooms (Playing State) */}
              <div className="analytics-table-card" style={{ padding: '24px', margin: 0 }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#ff4d4f', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                  ⚠️ Active Rooms Stuck in "Playing"
                </h4>
                <p style={{ fontSize: '12px', opacity: 0.6, margin: '-6px 0 16px 0', lineHeight: 1.35 }}>
                  Rooms currently in playing state grouped by host device, highlighting potential crash/freeze environments.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <div style={{ flex: 1, background: 'rgba(255,77,79,0.04)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,77,79,0.1)' }}>
                    <span style={{ display: 'block', fontSize: '12px', opacity: 0.6 }}>Desktop Host</span>
                    <strong style={{ fontSize: '22px', color: '#ff4d4f', display: 'block', marginTop: '4px' }}>{platformStats.playingDesktopHost}</strong>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,77,79,0.04)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,77,79,0.1)' }}>
                    <span style={{ display: 'block', fontSize: '12px', opacity: 0.6 }}>Mobile Host</span>
                    <strong style={{ fontSize: '22px', color: '#ff4d4f', display: 'block', marginTop: '4px' }}>{platformStats.playingMobileHost}</strong>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ display: 'block', fontSize: '12px', opacity: 0.5 }}>Legacy/Unknown</span>
                    <strong style={{ fontSize: '22px', opacity: 0.6, display: 'block', marginTop: '4px' }}>{platformStats.playingUnknownHost}</strong>
                  </div>
                </div>
              </div>

              {/* Card 3: Player Platform Breakdown */}
              <div className="analytics-table-card" style={{ padding: '24px', margin: 0 }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#2bc4be', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
                  👥 Joined Players by Platform
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '12.5px', opacity: 0.6 }}>Active Players (In Playing Rooms)</span>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Desktop</span>
                        <strong style={{ fontSize: '16px', color: '#00d2ff' }}>{platformStats.activePlayersDesktop}</strong>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Mobile</span>
                        <strong style={{ fontSize: '16px', color: 'var(--accent)' }}>{platformStats.activePlayersMobile}</strong>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Bots</span>
                        <strong style={{ fontSize: '16px', color: '#2bc4be' }}>{platformStats.activePlayersBot}</strong>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '12.5px', opacity: 0.6 }}>Total Players (All History)</span>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Desktop</span>
                        <strong style={{ fontSize: '16px', color: '#00d2ff' }}>{platformStats.totalPlayersDesktop}</strong>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Mobile</span>
                        <strong style={{ fontSize: '16px', color: 'var(--accent)' }}>{platformStats.totalPlayersMobile}</strong>
                      </div>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5 }}>Bots</span>
                        <strong style={{ fontSize: '16px', color: '#2bc4be' }}>{platformStats.totalPlayersBot}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Room Analytics stacked full-width */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%' }}>
              
              {/* Detailed Room Sessions Log (Full Width) */}
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
                        <th>Game Configuration</th>
                        <th>Packs Selected</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
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
                            
                            const isAbandoned = r.status === 'lobby' && 
                              r.createdAt && 
                              (typeof r.createdAt.toMillis === 'function' ? r.createdAt.toMillis() : (r.createdAt.seconds || 0) * 1000) < Date.now() - 3600000;

                            let badgeStyle = { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-block' };
                            if (r.status === 'playing') {
                              badgeStyle = { background: 'rgba(0,210,255,0.15)', color: '#00d2ff', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-block' };
                            } else if (r.status === 'completed') {
                              badgeStyle = { background: 'rgba(43,196,190,0.15)', color: '#2bc4be', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-block' };
                            } else if (r.status === 'ended') {
                              badgeStyle = { background: 'rgba(255,77,79,0.15)', color: '#ff4d4f', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-block' };
                            } else if (r.status === 'lobby') {
                              badgeStyle = { background: 'rgba(255,201,60,0.15)', color: 'var(--accent)', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-block' };
                            }
                            if (isAbandoned) {
                              badgeStyle = { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-block' };
                            }

                            const packIds = r.settings && Array.isArray(r.settings.packs) ? r.settings.packs : [];
                              
                            return (
                              <tr key={r.code || idx}>
                                <td style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '15px', color: 'var(--accent2)' }}>{r.code}</td>
                                <td style={{ fontWeight: 600 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>{r.hostName || 'Anonymous'}</span>
                                      {r.createdByPlatform && (
                                        <span 
                                          style={{ 
                                            fontSize: '9px', 
                                            padding: '1.5px 5px', 
                                            borderRadius: '4px', 
                                            background: r.createdByPlatform === 'mobile' ? 'rgba(255, 201, 60, 0.12)' : 'rgba(0, 210, 255, 0.12)', 
                                            color: r.createdByPlatform === 'mobile' ? 'var(--accent)' : '#00d2ff', 
                                            fontWeight: 700 
                                          }}
                                        >
                                          {r.createdByPlatform === 'mobile' ? '📱 Mobile' : '💻 Desktop'}
                                        </span>
                                      )}
                                    </div>
                                    {/* Player device mix */}
                                    {(() => {
                                      const roomPlayersList = playersAcrossRooms.filter(p => p.roomCode === r.code);
                                      const desktopCount = roomPlayersList.filter(p => p.platform === 'desktop').length;
                                      const mobileCount = roomPlayersList.filter(p => p.platform === 'mobile').length;
                                      const botCount = roomPlayersList.filter(p => p.platform === 'bot' || p.isBot).length;
                                      
                                      if (desktopCount === 0 && mobileCount === 0 && botCount === 0) return null;
                                      return (
                                        <div style={{ fontSize: '10.5px', opacity: 0.6, display: 'flex', gap: '8px', alignItems: 'center' }}>
                                          <span>Players:</span>
                                          {desktopCount > 0 && <span>💻 {desktopCount}</span>}
                                          {mobileCount > 0 && <span>📱 {mobileCount}</span>}
                                          {botCount > 0 && <span>🤖 {botCount}</span>}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                                <td style={{ opacity: 0.7, fontSize: '12.5px' }}>{dateStr}</td>
                                <td>
                                  <span style={badgeStyle}>
                                    {isAbandoned ? "Abandoned" : r.status.toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  {r.settings ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      <span style={{ fontWeight: 600, fontSize: '13px' }}>👤 Max: {r.settings.maxPlayers || 8} players</span>
                                      <span style={{ opacity: 0.6, fontSize: '11px' }}>⏱️ Timer: {r.settings.timer || 30}s | 🎯 Limit: {r.settings.scoreLimit || 5} pts</span>
                                    </div>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--accent)' }}>{packIds.length} pack{packIds.length === 1 ? '' : 's'} selected</span>
                                    {packIds.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '360px' }}>
                                        {packIds.map((pId: string) => {
                                          const pName = (packs || []).find(pk => pk.id === pId)?.name || pId;
                                          return (
                                            <span 
                                              key={pId} 
                                              className="custom-badge" 
                                              style={{ 
                                                background: 'rgba(255,255,255,0.05)', 
                                                color: 'rgba(255,255,255,0.6)',
                                                fontSize: '9.5px',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                border: '1px solid rgba(255,255,255,0.04)'
                                              }}
                                            >
                                              {pName}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="action-btn action-delete"
                                    onClick={() => handleDeleteRoom(r.code)}
                                    style={{
                                      background: 'rgba(255, 77, 79, 0.1)',
                                      color: '#ff4d4f',
                                      border: '1px solid rgba(255, 77, 79, 0.2)',
                                      borderRadius: '6px',
                                      padding: '4px 10px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    Wipe
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Column 2: Package Popularity Ranking (Full Width) */}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
            {/* 1. JSON Editor */}
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

            {/* 2. Database Status Panel (Premium Table) */}
            <section className="admin-panel admin-panel-status">
              <div className="admin-panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3>Card Catalog Status</h3>
                  <span className="admin-panel-subtitle">Manage expansion decks loaded in Firestore</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    Total: <strong style={{ color: 'var(--accent)' }}>{packs.length}</strong>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    In Firestore: <strong style={{ color: '#2BC4BE' }}>{firestorePacks.length}</strong>
                  </div>
                </div>
              </div>

              <div className="premium-table-wrap" style={{ marginTop: '16px' }}>
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Package Name</th>
                      <th>Package ID</th>
                      <th style={{ textAlign: 'center' }}>Cards</th>
                      <th>Price / Access</th>
                      <th>Target Audience</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {firestorePacks.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', opacity: 0.5 }}>
                          No packages seeded yet. Use the importer above to add packages.
                        </td>
                      </tr>
                    ) : (
                      firestorePacks.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 700, fontSize: '14px' }}>
                            {p.name}
                          </td>
                          <td style={{ fontFamily: 'monospace', opacity: 0.7, fontSize: '12.5px' }}>
                            {p.id}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800 }}>
                            {p.cards}
                          </td>
                          <td>
                            {p.free ? (
                              <span className="custom-badge" style={{ background: 'rgba(44,196,190,0.15)', color: '#2BC4BE', fontSize: '11px', padding: '3px 8px', borderRadius: '6px' }}>Free</span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                                <Coin size={12} /> {p.price}
                              </span>
                            )}
                          </td>
                          <td>
                            {p.familyFriendly === false ? (
                              <span className="custom-badge" style={{ background: 'rgba(255,77,79,0.15)', color: '#FF4D4F', fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px' }}>Adult</span>
                            ) : (
                              <span className="custom-badge" style={{ background: 'rgba(200,240,81,0.15)', color: 'var(--accent)', fontSize: '10.5px', padding: '2px 7px', borderRadius: '6px' }}>Family-Friendly</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="action-btn action-delete"
                              onClick={() => handleDeletePack(p.id)}
                              style={{
                                background: 'rgba(255, 77, 79, 0.1)',
                                color: '#ff4d4f',
                                border: '1px solid rgba(255, 77, 79, 0.2)',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {firestorePacks.length > 0 && (
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    className="clear-db-btn" 
                    onClick={handleClearFirestore}
                    style={{
                      background: 'rgba(255, 77, 79, 0.08)',
                      color: '#ff4d4f',
                      border: '1px solid rgba(255, 77, 79, 0.15)',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Wipe All Firestore Packages
                  </button>
                </div>
              )}
            </section>

            {/* 3. API logs output */}
            {terminalLogs.length > 0 && (
              <section className="admin-panel admin-panel-terminal">
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
        )}

      </div>
    </div>
  );
}
