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
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState<string | null>(null);

  // Load Firestore packs in real-time
  useEffect(() => {
    if (!isHydrated) return;
    let unsub: (() => void) | null = null;
    import('@/firebase/firestore').then(({ subscribePackages }) => {
      unsub = subscribePackages((pkgs) => setFirestorePacks(pkgs));
    });
    return () => { if (unsub) unsub(); };
  }, [isHydrated]);

  // Load purchases & users in real-time
  useEffect(() => {
    if (!isHydrated || !account || !account.admin) return;
    
    let isSubscribed = true;
    let unsubAuth: (() => void) | null = null;

    const fetchAnalytics = () => {
      import('@/firebase/firestore').then(({ getPurchases, getAllUsers }) => {
        if (!isSubscribed) return;
        Promise.all([getPurchases(), getAllUsers()]).then(([purchRes, userRes]) => {
          if (!isSubscribed) return;
          const safePurch = Array.isArray(purchRes) ? purchRes : [];
          const safeUsers = Array.isArray(userRes) ? userRes : [];
          safePurch.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
          setPurchases(safePurch);
          setUsers(safeUsers);
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
          <h2 className="create-title admin-title">Admin Catalog Console</h2>
          <span className="chip admin-secure-badge">● Secure Admin Session</span>
        </div>

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

          {/* Column 2: Status & Logs */}
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

            {/* Purchase Analytics Panel */}
            <section className="admin-panel admin-panel-status" style={{ marginTop: '20px' }}>
              <div className="admin-panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Purchase Analytics</h3>
                <button 
                  className="preset-btn" 
                  disabled={isMigrating} 
                  onClick={handleMigratePurchases}
                  style={{ margin: 0, padding: '4px 10px', fontSize: '12px' }}
                >
                  {isMigrating ? "Syncing..." : "🔄 Sync Legacy Purchases"}
                </button>
              </div>

              {migrationLog && (
                <div className="validation-bar validation-success" style={{ marginBottom: '14px', fontSize: '13px' }}>
                  {migrationLog}
                </div>
              )}

              <div className="status-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                <div className="status-item" style={{ padding: '10px' }}>
                  <span className="status-num" style={{ fontSize: '18px' }}>${stats.usdRevenue.toFixed(2)}</span>
                  <span className="status-label" style={{ fontSize: '11px' }}>USD Revenue</span>
                </div>
                <div className="status-item" style={{ padding: '10px' }}>
                  <span className="status-num" style={{ fontSize: '18px' }}>₹{stats.inrRevenue.toFixed(0)}</span>
                  <span className="status-label" style={{ fontSize: '11px' }}>INR Revenue</span>
                </div>
                <div className="status-item" style={{ padding: '10px' }}>
                  <span className="status-num" style={{ fontSize: '18px' }}>{stats.coinsBought}</span>
                  <span className="status-label" style={{ fontSize: '11px' }}>Coins Bought</span>
                </div>
              </div>

              <div className="status-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                <div className="status-item" style={{ padding: '10px' }}>
                  <span className="status-num" style={{ fontSize: '18px' }}>{stats.coinsSpent}</span>
                  <span className="status-label" style={{ fontSize: '11px' }}>Coins Spent</span>
                </div>
                <div className="status-item" style={{ padding: '10px' }}>
                  <span className="status-num" style={{ fontSize: '18px' }}>{stats.packsSpentCount}</span>
                  <span className="status-label" style={{ fontSize: '11px' }}>Packs Bought</span>
                </div>
                <div className="status-item" style={{ padding: '10px' }}>
                  <span className="status-num" style={{ fontSize: '18px' }}>{stats.upgradesSpentCount}</span>
                  <span className="status-label" style={{ fontSize: '11px' }}>Upgrades Bought</span>
                </div>
              </div>

              <div className="catalog-list-wrap">
                <h4 className="catalog-list-title">Recent Transactions ({filteredPurchases.length}):</h4>
                <div className="catalog-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredPurchases.length === 0 && <p className="muted" style={{ padding: '8px 0' }}>No purchase records found.</p>}
                  {filteredPurchases.map((p, idx) => (
                    <div key={p.id || idx} className="catalog-item" style={{ padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="catalog-item-main" style={{ fontSize: '13px' }}>
                        <span className="catalog-item-name" style={{ fontWeight: 600 }}>{p.itemName}</span>
                        <span 
                          className="custom-badge" 
                          style={{
                            background: p.type === 'top-up' ? 'rgba(43,196,190,0.15)' : 'rgba(255,201,60,0.15)',
                            color: p.type === 'top-up' ? '#2BC4BE' : '#FFC93C',
                            fontSize: '9px',
                            padding: '1px 5px'
                          }}
                        >
                          {p.type === 'top-up' ? 'Top-up' : 'Spend'}
                        </span>
                      </div>
                      <div className="catalog-item-meta" style={{ fontSize: '12px', marginTop: '3px' }}>
                        <span style={{ opacity: 0.6 }}>{p.userEmail}</span>
                        <span style={{ fontWeight: 700 }}>
                          {p.currency === 'coins' ? `${p.cost} coins` : p.currency === 'USD' ? `$${p.cost.toFixed(2)}` : `₹${p.cost.toFixed(0)}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Server logs / Console terminal */}
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
        </div>
      </div>
    </div>
  );
}
