// Point Blank — login, profile, and marketplace screens + economy catalog

const UPGRADES = [
  { id: "mp10", name: "Bigger Party", desc: "Host rooms with up to 10 players", price: 300 },
  { id: "mp20", name: "House Party", desc: "Host rooms with up to 20 players", price: 600 },
  { id: "swapPlus", name: "Swap Master", desc: "Swap up to 5 cards, and earn swaps every 2 rounds", price: 250 },
  { id: "customCards", name: "Custom Cards Studio", desc: "Write your own prompts and answers for any room", price: 200 }
];

const CREDIT_BUNDLES = [
  { coins: 500, tag: "$4.99" },
  { coins: 1200, tag: "$9.99", best: true },
  { coins: 3000, tag: "$19.99" }
];

const AVATAR_COLORS = ["#FF5C39", "#7C5CFF", "#2BC4BE", "#FF4D8D", "#5CA9FF", "#FFC93C"];

function freePackNames() {
  return window.GAME_DATA.packs.filter((p) => p.free).map((p) => p.name);
}
function maxPlayersFor(account) {
  if (account && account.upgrades.includes("mp20")) return 20;
  if (account && account.upgrades.includes("mp10")) return 10;
  return 5;
}
function ownsPack(account, p) {
  return !!p.free || (account ? account.packs.includes(p.name) : false);
}

/* ---------- Login ---------- */
function LoginScreen({ account, onDone, onCancel }) {
  const [name, setName] = React.useState(account ? account.name : "");
  const [email, setEmail] = React.useState(account ? account.email : "");
  const [color, setColor] = React.useState(account ? account.color : AVATAR_COLORS[0]);
  return (
    <div className="screen center-screen" data-screen-label="Log in">
      <div className="auth">
        <h2 className="auth-title">Who's laughing?</h2>
        <p className="auth-sub">One account, all your packs and coins — on any device.</p>
        <div className="frow">
          <label className="flabel">Display name</label>
          <input className="input" value={name} maxLength="14" autoFocus={true}
            placeholder="e.g. Alex" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="frow">
          <label className="flabel">Email</label>
          <input className="input" type="email" value={email} placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="frow">
          <label className="flabel">Avatar color</label>
          <div className="colorrow">
            {AVATAR_COLORS.map((c) => (
              <button key={c} className={"colordot" + (c === color ? " colordot-on" : "")}
                style={{ background: c }} onClick={() => setColor(c)} aria-label={c}></button>
            ))}
          </div>
        </div>
        <Btn big={true} className="auth-cta" disabled={!name.trim()}
          onClick={() => onDone({ name: name.trim(), email: email.trim(), color: color, guest: false })}>
          {account ? "Save profile" : "Create account"}
        </Btn>
        <div className="auth-alt">
          {!account ? (
            <button className="linkbtn" onClick={() => onDone({ name: "Guest", email: "", color: AVATAR_COLORS[4], guest: true })}>
              Skip — play as guest
            </button>
          ) : null}
          <button className="linkbtn" onClick={onCancel}>Cancel</button>
        </div>
        <p className="auth-note">New accounts start with <Coin size={13} /> 500 coins on the house.</p>
      </div>
    </div>
  );
}

/* ---------- Profile ---------- */
function ProfileScreen({ account, onBack, onStore, onCoins, onEdit, onLogout }) {
  const a = account;
  const ownedPaid = window.GAME_DATA.packs.filter((p) => !p.free && a.packs.includes(p.name));
  const ownedUpgrades = UPGRADES.filter((u) => a.upgrades.includes(u.id));
  return (
    <div className="screen create-screen" data-screen-label="Profile">
      <header className="create-head">
        <button className="iconbtn create-back" onClick={onBack} aria-label="Back">←</button>
        <Logo />
      </header>
      <div className="create-body">
        <div className="profile-hero">
          <Avatar player={a} size={72} />
          <div className="profile-id">
            <h2 className="profile-name">{a.name}{a.guest ? " (guest)" : ""}</h2>
            <span className="profile-email">{a.email || "No email — guest account"}</span>
            <span className="profile-meta">{a.games} games · {a.wins} wins · joined {new Date(a.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="profile-hero-actions">
            <Btn variant="secondary" onClick={onEdit}>Edit profile</Btn>
            <Btn variant="ghost" onClick={onLogout}>Log out</Btn>
          </div>
        </div>

        <div className="profile-grid">
          <section className="profile-card profile-balance">
            <span className="store-sec-label">Balance</span>
            <span className="balance-big"><Coin size={26} /> {a.credits.toLocaleString()}</span>
            <Btn variant="accent" onClick={onCoins}>Get more coins</Btn>
          </section>

          <section className="profile-card">
            <span className="store-sec-label">Your packs <span className="muted">{a.packs.length}</span></span>
            <div className="profile-chips">
              {window.GAME_DATA.packs.filter((p) => p.free).map((p) => (
                <span key={p.name} className="packchip packchip-on profile-chip-static">{p.name}<span className="packchip-count">free</span></span>
              ))}
              {ownedPaid.map((p) => (
                <span key={p.name} className="packchip packchip-on profile-chip-static">{p.name}<span className="packchip-count">{p.cards}</span></span>
              ))}
            </div>
            <button className="linkbtn" onClick={onStore}>Browse more packs →</button>
          </section>

          <section className="profile-card">
            <span className="store-sec-label">Upgrades</span>
            {ownedUpgrades.length ? (
              <ul className="profile-upglist">
                {ownedUpgrades.map((u) => (
                  <li key={u.id}><b>{u.name}</b><span className="muted"> — {u.desc}</span></li>
                ))}
              </ul>
            ) : (
              <p className="muted profile-empty">No upgrades yet. Bigger rooms and card swaps await.</p>
            )}
            <button className="linkbtn" onClick={onStore}>See upgrades →</button>
          </section>

          <section className="profile-card profile-history">
            <span className="store-sec-label">Coin history</span>
            {a.history.length ? (
              <ul className="historylist">
                {a.history.slice(0, 8).map((h, i) => (
                  <li key={i} className="historyrow">
                    <span className="history-label">{h.label}</span>
                    <span className={"history-delta" + (h.delta > 0 ? " history-plus" : "")}>
                      {h.delta > 0 ? "+" : ""}{h.delta}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted profile-empty">Nothing yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- Marketplace ---------- */
const STORE_SECTIONS = [
  { id: "packs", label: "Card packs" },
  { id: "upgrades", label: "Upgrades" }
];

function StoreScreen({ account, onBack, onLogin, onCoins, buyPack, buyUpgrade }) {
  const a = account;
  const packs = window.GAME_DATA.packs;
  const [active, setActive] = React.useState("packs");
  const refs = React.useRef({});
  function canAfford(price) { return a && a.credits >= price; }

  function goSection(id) {
    const el = refs.current[id];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 86;
    window.scrollTo({ top: y, behavior: "smooth" });
    setActive(id);
  }

  /* Track which section is in view while scrolling */
  React.useEffect(() => {
    function onScroll() {
      let cur = "packs";
      STORE_SECTIONS.forEach((s) => {
        const el = refs.current[s.id];
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.35) cur = s.id;
      });
      setActive(cur);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ownedCount = packs.filter((p) => ownsPack(a, p)).length;
  const counts = {
    packs: ownedCount + " / " + packs.length,
    upgrades: (a ? a.upgrades.length : 0) + " / " + UPGRADES.length
  };

  return (
    <div className="screen create-screen" data-screen-label="Marketplace">
      <header className="create-head store-head">
        <button className="iconbtn create-back" onClick={onBack} aria-label="Back">←</button>
        <Logo />
        <span className="store-balance">
          {a ? (
            <React.Fragment><Coin size={18} /> {a.credits.toLocaleString()}</React.Fragment>
          ) : (
            <button className="linkbtn" onClick={onLogin}>Log in to buy</button>
          )}
        </span>
      </header>
      <div className="create-body store-layout">
        <h2 className="create-title store-title">Marketplace</h2>
        <nav className="store-nav">
          {STORE_SECTIONS.map((s) => (
            <button
              key={s.id}
              className={"store-nav-btn" + (active === s.id ? " store-nav-on" : "")}
              onClick={() => goSection(s.id)}
            >
              {s.label}
              <span className="store-nav-count">{counts[s.id]}</span>
            </button>
          ))}
          <div className="store-nav-split"></div>
          <button className="store-nav-btn store-nav-coins" onClick={onCoins}>
            <span className="store-nav-coinlabel"><Coin size={13} /> Get coins</span>
            <span className="store-nav-count">→</span>
          </button>
        </nav>

        <div className="store-content">
          <section ref={(el) => (refs.current.packs = el)}>
            <h3 className="store-sec store-sec-first">Card packs</h3>
            <div className="store-grid">
              {packs.map((p) => {
                const owned = ownsPack(a, p);
                return (
                  <div key={p.name} className={"store-card" + (owned ? " store-owned" : "")}>
                    <span className="store-card-name">{p.name}</span>
                    <span className="store-card-sub">{p.cards} cards</span>
                    {p.free ? (
                      <span className="store-tag">Included free</span>
                    ) : owned ? (
                      <span className="store-tag store-tag-owned">✓ Owned</span>
                    ) : (
                      <button
                        className="buybtn"
                        disabled={!a || !canAfford(p.price)}
                        onClick={() => (a ? buyPack(p) : onLogin())}
                      >
                        <Coin size={13} /> {p.price}
                        {a && !canAfford(p.price) ? <span className="buybtn-no">not enough</span> : null}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section ref={(el) => (refs.current.upgrades = el)}>
            <h3 className="store-sec">Upgrades</h3>
            <div className="store-grid store-grid-wide">
              {UPGRADES.map((u) => {
                const owned = a && a.upgrades.includes(u.id);
                return (
                  <div key={u.id} className={"store-card" + (owned ? " store-owned" : "")}>
                    <span className="store-card-name">{u.name}</span>
                    <span className="store-card-sub">{u.desc}</span>
                    {owned ? (
                      <span className="store-tag store-tag-owned">✓ Owned</span>
                    ) : (
                      <button className="buybtn" disabled={!a || !canAfford(u.price)}
                        onClick={() => (a ? buyUpgrade(u) : onLogin())}>
                        <Coin size={13} /> {u.price}
                        {a && !canAfford(u.price) ? <span className="buybtn-no">not enough</span> : null}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="store-earn-note">Running low? <button className="linkbtn" onClick={onCoins}>Get more coins →</button></p>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---------- Coins page ---------- */
function CoinsScreen({ account, onBack, onLogin, buyCredits }) {
  const a = account;
  return (
    <div className="screen create-screen" data-screen-label="Coins">
      <header className="create-head store-head">
        <button className="iconbtn create-back" onClick={onBack} aria-label="Back">←</button>
        <Logo />
        <span className="store-balance">
          {a ? (
            <React.Fragment><Coin size={18} /> {a.credits.toLocaleString()}</React.Fragment>
          ) : (
            <button className="linkbtn" onClick={onLogin}>Log in to buy</button>
          )}
        </span>
      </header>
      <div className="create-body coins-body">
        <h2 className="create-title">Coins</h2>
        <p className="store-earn-note">Earn coins by playing: <b>+25</b> per finished game, <b>+75 bonus</b> for winning. Or top up:</p>
        <div className="store-grid store-grid-wide">
          {CREDIT_BUNDLES.map((b) => (
            <div key={b.coins} className={"store-card bundle" + (b.best ? " bundle-best" : "")}>
              {b.best ? <span className="bundle-flag">Best value</span> : null}
              <span className="store-card-name"><Coin size={18} /> {b.coins.toLocaleString()}</span>
              <span className="store-card-sub">coins</span>
              <button className="buybtn" onClick={() => (a ? buyCredits(b) : onLogin())}>{b.tag}</button>
            </div>
          ))}
        </div>
        <p className="coins-note">Coins are spent in the Marketplace on packs and upgrades. Purchases here are simulated — no real money involved.</p>
      </div>
    </div>
  );
}

Object.assign(window, {
  UPGRADES, CREDIT_BUNDLES, AVATAR_COLORS, freePackNames, maxPlayersFor, ownsPack,
  LoginScreen, ProfileScreen, StoreScreen, CoinsScreen
});
