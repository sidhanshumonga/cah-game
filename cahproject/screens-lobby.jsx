// Point Blank — Landing, Create Room, Lobby screens

// ----- Cross-promo for your other game. Swap these 3 values to point at the real app. -----
const OTHER_GAME = {
  name: "Hot Seat",                 // placeholder name — replace with your other game
  pitch: "The party game where your friends answer for you. Awkward, guaranteed.",
  url: "https://your-other-game.example.com"   // placeholder URL — replace with the real link
};

function CrossPromo() {
  return (
    <a className="crosspromo" href={OTHER_GAME.url} target="_blank" rel="noopener noreferrer">
      <span className="crosspromo-badge">New</span>
      <span className="crosspromo-clip" aria-hidden="true"><span className="crosspromo-shine"></span></span>
      <span className="crosspromo-body">
        <span className="crosspromo-kicker">Also from our table</span>
        <span className="crosspromo-name">{OTHER_GAME.name}</span>
        <span className="crosspromo-pitch">{OTHER_GAME.pitch}</span>
      </span>
      <span className="crosspromo-go">Play<span className="crosspromo-arrow">→</span></span>
    </a>
  );
}

// ----- Auto-rotating sample round shown on the homepage -----
const SAMPLE_PAIRS = [
  { prompt: "My secret talent is ____.", answer: "aggressive interpretive dance" },
  { prompt: "The real reason I was late today: ____.", answer: "a haunted Roomba" },
  { prompt: "New from IKEA: the ____.", answer: "decorative gourds" },
  { prompt: "My villain origin story began with ____.", answer: "a group project" },
  { prompt: "Rejected ice cream flavor: ____.", answer: "lukewarm soup" },
  { prompt: "What's that smell? Oh, it's ____.", answer: "my browser history" }
];

function SampleDeck() {
  const [i, setI] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((n) => (n + 1) % SAMPLE_PAIRS.length), 3400);
    return () => clearInterval(t);
  }, [paused]);
  const pair = SAMPLE_PAIRS[i];
  function advance() { setI((n) => (n + 1) % SAMPLE_PAIRS.length); }
  return (
    <div
      className="sample-deck"
      onClick={advance}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      title="Click for another"
    >
      <span className="sample-kicker">A taste of the deck</span>
      <div className="sample-cards">
        <PromptCard key={"p" + i} text={pair.prompt} small={true} className="sample-prompt" />
        <span className="sample-plus" aria-hidden="true">+</span>
        <AnswerCard key={"a" + i} text={pair.answer} small={true} className="sample-answer" />
      </div>
      <div className="sample-dots" aria-hidden="true">
        {SAMPLE_PAIRS.map((_, k) => (
          <span key={k} className={"sample-dot" + (k === i ? " sample-dot-on" : "")}></span>
        ))}
      </div>
    </div>
  );
}

// ----- Quiet feedback popover for the landing page -----
function FeedbackTab() {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [sent, setSent] = React.useState(false);
  function submit() {
    if (!text.trim()) return;
    setSent(true);
    setTimeout(() => { setOpen(false); setTimeout(() => { setSent(false); setText(""); }, 300); }, 1400);
  }
  return (
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
                <button className="iconbtn" onClick={() => setOpen(false)} aria-label="Close">✕</button>
              </div>
              <p className="fbpop-sub">Bug, idea, or just a hello — drop it here.</p>
              <textarea
                className="input fbpop-area"
                rows="3"
                placeholder="What's on your mind?"
                value={text}
                maxLength="400"
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
      <button className="fbbtn" onClick={() => setOpen((o) => !o)}>
        <span className="fbbtn-dot"></span> Feedback
      </button>
    </div>
  );
}

function Landing({ account, onCreate, onJoin, onLogin, onProfile, onHowTo }) {
  const [joining, setJoining] = React.useState(false);
  const [code, setCode] = React.useState("");
  const decor = [
    { text: "an emotional support raccoon", x: "6%", y: "14%", r: -12, d: 0 },
    { text: "My secret talent is ____.", x: "78%", y: "10%", r: 9, d: 1.2, dark: true },
    { text: "one single crouton", x: "84%", y: "62%", r: -7, d: 0.6 },
    { text: "a haunted Roomba", x: "4%", y: "66%", r: 8, d: 1.8 },
    { text: "Rejected ice cream flavor: ____.", x: "14%", y: "40%", r: -4, d: 2.4, dark: true },
    { text: "seventeen alarms, all snoozed", x: "72%", y: "36%", r: 5, d: 3 }
  ];
  return (
    <div className="screen landing" data-screen-label="Landing">
      <div className="landing-top">
        {account ? (
          <button className="userchip" onClick={onProfile}>
            <Avatar player={account} size={26} />
            <span className="userchip-name">{account.name}</span>
            <span className="userchip-coins"><Coin size={13} /> {account.credits.toLocaleString()}</span>
          </button>
        ) : (
          <Btn variant="secondary" onClick={onLogin}>Log in</Btn>
        )}
      </div>
      <div className="bgcards" aria-hidden="true">
        {decor.map((c, i) => (
          <div
            key={i}
            className={"bgcard" + (c.dark ? " bgcard-dark" : "")}
            style={{ left: c.x, top: c.y, "--r": c.r + "deg", animationDelay: c.d + "s" }}
          >
            {c.text}
          </div>
        ))}
      </div>
      <div className="hero">
        <h1 className="hero-logo"><Logo big={true} /></h1>
        <p className="tagline">The fill&#8209;in&#8209;the&#8209;blank party game for people with questionable friends.</p>
        <SampleDeck />
        {!joining ? (
          <div className="landing-actions">
            <Btn big={true} onClick={onCreate}>Create a room</Btn>
            <Btn big={true} variant="secondary" onClick={() => setJoining(true)}>Join a room</Btn>
          </div>
        ) : (
          <div className="landing-actions joinrow">
            <input
              className="input input-code"
              maxLength="4"
              placeholder="CODE"
              value={code}
              autoFocus={true}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter" && code.length === 4) onJoin(code); }}
            />
            <Btn big={true} disabled={code.length !== 4} onClick={() => onJoin(code)}>Join</Btn>
            <Btn big={true} variant="ghost" onClick={() => setJoining(false)}>Back</Btn>
          </div>
        )}
        <ul className="feature-row">
          <li>Play with friends online</li>
          <li>No downloads, nothing to install</li>
          <li>Phones, laptops, whatever</li>
        </ul>
        <button className="howto-link" onClick={onHowTo}>
          <span className="howto-link-q">?</span> New here? How to play
        </button>
        <CrossPromo />
      </div>
      <FeedbackTab />
    </div>
  );
}

/* ---------- Create Room ---------- */
const ALL_PACKS = window.GAME_DATA.packs;
const MAX_PACKS = 8;

function Seg({ options, value, onChange, format }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o}
          className={"seg-btn" + (o === value ? " seg-on" : "")}
          onClick={() => onChange(o)}
        >
          {format ? format(o) : o}
        </button>
      ))}
    </div>
  );
}

function Switch({ on, onChange }) {
  return (
    <button className={"switch" + (on ? " switch-on" : "")} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="switch-knob"></span>
    </button>
  );
}

function CreateRoom({ initial, account, onBack, onStore, onCreate }) {
  const allowed = maxPlayersFor(account);
  const hasCustom = !!(account && account.upgrades.includes("customCards"));
  const [name, setName] = React.useState(account ? account.name : initial.name);
  const [maxPlayers, setMaxPlayers] = React.useState(Math.min(initial.maxPlayers, allowed));
  const [scoreLimit, setScoreLimit] = React.useState(initial.scoreLimit);
  const [timer, setTimer] = React.useState(initial.timer);
  const [packs, setPacks] = React.useState(initial.packs);
  const [family, setFamily] = React.useState(initial.family);
  const [custom, setCustom] = React.useState(initial.custom && hasCustom);
  const [packQuery, setPackQuery] = React.useState("");
  const [lockedHint, setLockedHint] = React.useState(null);
  const atMax = packs.length >= MAX_PACKS;
  function togglePack(p) {
    setPacks((s) => {
      if (s.includes(p)) return s.filter((x) => x !== p);
      if (s.length >= MAX_PACKS) return s;
      return [...s, p];
    });
  }
  function randomPacks() {
    const owned = ALL_PACKS.filter((p) => ownsPack(account, p));
    const shuffled = [...owned].sort(() => Math.random() - 0.5);
    setPacks(shuffled.slice(0, 3).map((p) => p.name));
  }
  const filteredPacks = ALL_PACKS.filter((p) => p.name.toLowerCase().includes(packQuery.trim().toLowerCase()));
  return (
    <div className="screen create-screen" data-screen-label="Create Room">
      <header className="create-head">
        <button className="iconbtn create-back" onClick={onBack} aria-label="Back">←</button>
        <Logo />
      </header>
      <div className="create-body">
        <h2 className="create-title">Set up your room</h2>
        <div className="create-grid">
          <section className="create-col">
            <h3 className="create-sec">Basics</h3>
            <div className="frow">
              <label className="flabel">Your name</label>
              <input className="input" value={name} maxLength="14" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="frow">
              <label className="flabel">Max players <span className="flabel-val">{maxPlayers}</span></label>
              <input
                className="range"
                type="range" min="3" max={allowed} step="1" value={maxPlayers}
                onChange={(e) => setMaxPlayers(+e.target.value)}
              />
              {allowed < 20 ? (
                <span className="upsell"><LockIcon size={11} /> Rooms cap at {allowed} players — <button className="linkbtn" onClick={onStore}>upgrade in the Marketplace</button></span>
              ) : null}
            </div>
            <div className="frow">
              <label className="flabel">Points to win</label>
              <Seg options={[3, 5, 7]} value={scoreLimit} onChange={setScoreLimit} />
            </div>
            <div className="frow">
              <label className="flabel">Turn timer</label>
              <Seg options={[30, 45, 60]} value={timer} onChange={setTimer} format={(o) => o + "s"} />
            </div>
            <div className="frow frow-inline">
              <label className="flabel">Custom cards</label>
              {hasCustom ? (
                <Switch on={custom} onChange={setCustom} />
              ) : (
                <button className="lockpill" onClick={onStore}><LockIcon size={11} /> Unlock in Marketplace</button>
              )}
            </div>
            <div className="frow frow-inline">
              <label className="flabel">Family-friendly mode</label>
              <Switch on={family} onChange={setFamily} />
            </div>
          </section>
          <section className="create-col">
            <h3 className="create-sec">Card packs <span className="flabel-val">{packs.length} selected</span></h3>
            <div className="packbox">
              <div className="packbox-tools">
                <input
                  className="input packsearch"
                  placeholder={"Search " + ALL_PACKS.length + " packs\u2026"}
                  value={packQuery}
                  onChange={(e) => setPackQuery(e.target.value)}
                />
                <button className="packtool" onClick={randomPacks}>Surprise me</button>
                <button className="packtool" onClick={() => setPacks([])} disabled={packs.length === 0}>Clear</button>
                <button className="packtool packtool-store" onClick={onStore}><Coin size={12} /> Marketplace</button>
              </div>
              <div className="packlist">
                {filteredPacks.map((p) => {
                  const owned = ownsPack(account, p);
                  const on = packs.includes(p.name);
                  if (!owned) {
                    return (
                      <button key={p.name} className="packchip packchip-locked" onClick={() => setLockedHint(p)}>
                        <LockIcon size={11} /> {p.name}<span className="packchip-price"><Coin size={11} /> {p.price}</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={p.name}
                      className={"packchip" + (on ? " packchip-on" : "")}
                      disabled={!on && atMax}
                      onClick={() => togglePack(p.name)}
                    >
                      {p.name}<span className="packchip-count">{p.cards}</span>
                    </button>
                  );
                })}
                {filteredPacks.length === 0 ? (
                  <p className="pack-nomatch">No packs match “{packQuery}”</p>
                ) : null}
              </div>
              {lockedHint ? (
                <p className="packbox-hint packbox-hint-lock">
                  “{lockedHint.name}” is locked — get it for <Coin size={12} /> {lockedHint.price} in the <button className="linkbtn" onClick={onStore}>Marketplace</button>
                </p>
              ) : (
                <p className={"packbox-hint" + (atMax ? " packbox-hint-max" : "")}>
                  {atMax ? "Max " + MAX_PACKS + " packs \u2014 deselect one to swap" : "Pick up to " + MAX_PACKS + " packs"}
                </p>
              )}
            </div>
          </section>
        </div>
        <div className="create-cta">
          <Btn big={true} disabled={packs.length === 0}
            onClick={() => onCreate({ name: name || "Alex", maxPlayers, scoreLimit, timer, packs, family, custom })}>
            {packs.length === 0 ? "Pick at least 1 pack" : "Create room"}
          </Btn>
          <span className="create-cta-hint">You'll get a room code and invite link to share</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Lobby ---------- */
function Lobby({ mode, settings, onLeave, onStart }) {
  const code = React.useMemo(() => {
    const L = "BCDFGHJKLMNPRSTVWZ";
    return Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join("");
  }, []);
  const you = React.useMemo(
    () => ({ id: "you", name: settings.name || "Alex", color: "#FF5C39", isYou: true }),
    []
  );
  const bots = window.GAME_DATA.bots;
  const [joined, setJoined] = React.useState([you]);
  const [ready, setReady] = React.useState({ you: mode === "host" });
  const [msgs, setMsgs] = React.useState([]);
  const [draft, setDraft] = React.useState("");
  const [copied, setCopied] = React.useState(null);
  const isHost = mode === "host";

  // Bots trickle in, then ready up
  React.useEffect(() => {
    const timers = [];
    bots.forEach((b, i) => {
      timers.push(setTimeout(() => {
        setJoined((s) => (s.some((p) => p.id === b.id) ? s : [...s, { ...b, isBot: true }]));
        timers.push(setTimeout(() => setReady((r) => ({ ...r, [b.id]: true })), 900 + Math.random() * 2200));
      }, 800 + i * 950));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  // Canned chat
  React.useEffect(() => {
    const timers = window.GAME_DATA.chatLines.map((line, i) =>
      setTimeout(() => {
        setMsgs((s) => [...s, { who: line.who, text: line.text, id: i }]);
      }, 2400 + i * 1700)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Join mode: host starts once you're ready and the room is full
  React.useEffect(() => {
    if (isHost || !ready.you || joined.length < 5) return;
    const t = setTimeout(() => onStart(joined), 2200);
    return () => clearTimeout(t);
  }, [ready.you, joined, isHost]);

  function copy(text, which) {
    try { navigator.clipboard.writeText(text); } catch (e) { /* noop */ }
    setCopied(which);
    setTimeout(() => setCopied(null), 1400);
  }
  function kick(id) {
    setJoined((s) => s.filter((p) => p.id !== id));
  }
  function send() {
    if (!draft.trim()) return;
    setMsgs((s) => [...s, { who: "you", text: draft.trim(), id: "u" + s.length }]);
    setDraft("");
  }
  const byId = (id) => joined.find((p) => p.id === id);
  const canStart = joined.length >= 3;
  const slots = Math.min(settings.maxPlayers, 8);
  const host = isHost ? you : joined.find((p) => p.id === "b1") || you;

  return (
    <div className="screen lobby" data-screen-label="Lobby">
      <div className="lobby-head">
        <Logo />
        <div className="lobby-code">
          <span className="lobby-code-label">Room code</span>
          <button className="lobby-code-val" onClick={() => copy(code, "code")} title="Copy code">
            {code}
            <span className="copy-hint">{copied === "code" ? "Copied!" : "Copy"}</span>
          </button>
        </div>
        <button className="chip" onClick={() => copy("cah.game/" + code, "link")}>
          {copied === "link" ? "Link copied!" : "cah.game/" + code}
        </button>
        <button className="iconbtn lobby-leave" onClick={onLeave} aria-label="Leave room">✕</button>
      </div>

      <div className="lobby-grid">
        <section className="lobby-main">
          <h3 className="lobby-sec-title">Players <span className="muted">{joined.length} / {settings.maxPlayers}</span></h3>
          <div className="ptiles">
            {joined.map((p) => (
              <div key={p.id} className="ptile">
                <Avatar player={p} size={52} judge={p.id === host.id} done={!!ready[p.id]} />
                <span className="ptile-name">{p.name}{p.isYou ? " (you)" : ""}</span>
                <span className={"ptile-status" + (ready[p.id] ? " ptile-ready" : "")}>
                  {ready[p.id] ? "Ready" : "Joining…"}
                </span>
                {isHost && p.isBot ? (
                  <button className="ptile-kick" onClick={() => kick(p.id)} title="Remove player">✕</button>
                ) : null}
              </div>
            ))}
            {Array.from({ length: Math.max(0, slots - joined.length) }, (_, i) => (
              <div key={"e" + i} className="ptile ptile-empty">
                <span className="ptile-empty-circle"></span>
                <span className="ptile-name muted">Waiting…</span>
              </div>
            ))}
          </div>

          <div className="lobby-settings">
            <span className="chip">First to {settings.scoreLimit} pts</span>
            <span className="chip">{settings.timer}s timer</span>
            <span className="chip">
              {settings.packs.length} pack{settings.packs.length > 1 ? "s" : ""}: {settings.packs.length > 2 ? settings.packs.slice(0, 2).join(", ") + " +" + (settings.packs.length - 2) + " more" : settings.packs.join(", ")}
            </span>
            {settings.family ? <span className="chip">Family-friendly</span> : null}
            {settings.custom ? <span className="chip">Custom cards on</span> : null}
          </div>

          <div className="lobby-cta">
            {isHost ? (
              <Btn big={true} disabled={!canStart} onClick={() => onStart(joined)}>
                {canStart ? "Start game" : "Need at least 3 players…"}
              </Btn>
            ) : ready.you ? (
              <span className="waiting-host">You're ready — waiting for {host.name} to start<span className="dots"><i>.</i><i>.</i><i>.</i></span></span>
            ) : (
              <Btn big={true} onClick={() => setReady((r) => ({ ...r, you: true }))}>I'm ready</Btn>
            )}
          </div>
        </section>

        <aside className="lobby-chat">
          <h3 className="lobby-sec-title">Chat</h3>
          <div className="chat-msgs">
            {msgs.map((m) => {
              const p = byId(m.who);
              if (!p) return null;
              return (
                <div key={m.id} className={"chat-msg" + (p.isYou ? " chat-mine" : "")}>
                  <Avatar player={p} size={26} />
                  <span className="chat-bubble"><b>{p.name}</b> {m.text}</span>
                </div>
              );
            })}
            {msgs.length === 0 ? <p className="muted chat-empty">Say hi while everyone joins…</p> : null}
          </div>
          <div className="chat-inputrow">
            <input
              className="input chat-input"
              placeholder="Message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            />
            <Btn onClick={send}>Send</Btn>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { Landing, CreateRoom, Lobby, Seg, Switch, ALL_PACKS });
