// Point Blank — app shell, theming, routing, tweaks

const PALETTES = {
  night: {
    label: "Night", bg: "#15131D", fg: "#F2EFE6", paper: "#F8F5EC", paperFg: "#181520",
    dark: "#0D0B13", darkFg: "#F2EFE6", accent: "#C8F051", accent2: "#8F7BFF",
    btnBg: "#F2EFE6", btnFg: "#15131D", accentPaper: "#557210",
    swatch: ["#15131D", "#C8F051", "#8F7BFF", "#F8F5EC"]
  },
  pop: {
    label: "Pop", bg: "#F6F1E7", fg: "#1A1408", paper: "#FFFEFA", paperFg: "#221A0E",
    dark: "#171208", darkFg: "#FBF7EE", accent: "#FF5C39", accent2: "#FFC93C",
    btnBg: "#171208", btnFg: "#FBF7EE", accentPaper: "#D8431F",
    swatch: ["#F6F1E7", "#FF5C39", "#FFC93C", "#171208"]
  },
  candy: {
    label: "Candy", bg: "#FDF0F4", fg: "#2A1220", paper: "#FFFFFF", paperFg: "#2A1220",
    dark: "#2A1220", darkFg: "#FFF6FA", accent: "#FF3D7F", accent2: "#2BC4BE",
    btnBg: "#2A1220", btnFg: "#FFF6FA", accentPaper: "#D81B62",
    swatch: ["#FDF0F4", "#FF3D7F", "#2BC4BE", "#2A1220"]
  }
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "night",
  "radius": 18,
  "motion": 10,
  "swapMax": 3
}/*EDITMODE-END*/;

const DEFAULT_SETTINGS = {
  name: "Alex", maxPlayers: 5, scoreLimit: 3, timer: 45,
  packs: ["Classic", "Memes & Internet"], family: false, custom: false
};

function makeAccount(info) {
  return {
    name: info.name, email: info.email || "", color: info.color, guest: !!info.guest,
    credits: 500, packs: freePackNames(), upgrades: [],
    history: [{ label: "Welcome bonus", delta: 500, ts: Date.now() }],
    wins: 0, games: 0, createdAt: Date.now()
  };
}

function usePBAccount() {
  const [account, setAccount] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("pb-account") || "null"); } catch (e) { return null; }
  });
  React.useEffect(() => {
    try {
      if (account) localStorage.setItem("pb-account", JSON.stringify(account));
      else localStorage.removeItem("pb-account");
    } catch (e) { /* noop */ }
  }, [account]);
  return [account, setAccount];
}

function makeDefaultRoster(name) {
  return [
    { id: "you", name: name || "Alex", color: "#FF5C39", isYou: true },
    ...window.GAME_DATA.bots.map((b) => ({ ...b, isBot: true }))
  ];
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const pal = PALETTES[t.palette] || PALETTES.night;
  const [account, setAccount] = usePBAccount();
  const [screen, setScreen] = React.useState("landing");
  const [prevScreen, setPrevScreen] = React.useState("landing");
  const [mode, setMode] = React.useState("host");
  const [settings, setSettings] = React.useState(DEFAULT_SETTINGS);
  const [roster, setRoster] = React.useState(null);
  const [endData, setEndData] = React.useState(null);
  const [gameKey, setGameKey] = React.useState(1);
  const [demo, setDemo] = React.useState(null);

  function go(target) {
    setPrevScreen(screen);
    setScreen(target);
  }

  React.useEffect(() => {
    document.body.style.background = pal.bg;
  }, [pal]);

  const vars = {
    "--bg": pal.bg, "--fg": pal.fg, "--paper": pal.paper, "--paper-fg": pal.paperFg,
    "--dark": pal.dark, "--dark-fg": pal.darkFg, "--accent": pal.accent, "--accent2": pal.accent2,
    "--btn-bg": pal.btnBg, "--btn-fg": pal.btnFg, "--accent-paper": pal.accentPaper,
    "--radius": t.radius + "px", "--m": Math.max(0.05, t.motion / 10)
  };

  function startGame(r) {
    setRoster(r);
    setDemo(null);
    setGameKey((k) => k + 1);
    setScreen("game");
  }
  function handleEnd(players, history) {
    let earned = 0;
    if (account) {
      const you = players.find((p) => p.isYou);
      const top = Math.max.apply(null, players.map((p) => p.score));
      const won = you && you.score === top;
      earned = 25 + (won ? 75 : 0);
      setAccount((a) => a ? {
        ...a,
        credits: a.credits + earned,
        games: a.games + 1,
        wins: a.wins + (won ? 1 : 0),
        history: [{ label: won ? "Won a game" : "Finished a game", delta: earned, ts: Date.now() }, ...a.history]
      } : a);
    }
    setEndData({ players: players, history: history, earned: earned });
    setScreen("end");
  }

  /* ----- economy ----- */
  function spend(cost, label, apply) {
    setAccount((a) => {
      if (!a || a.credits < cost) return a;
      const b = apply({ ...a, credits: a.credits - cost });
      b.history = [{ label: label, delta: -cost, ts: Date.now() }, ...b.history];
      return b;
    });
  }
  function buyPack(p) {
    spend(p.price, "Pack: " + p.name, (a) => ({ ...a, packs: [...a.packs, p.name] }));
  }
  function buyUpgrade(u) {
    spend(u.price, "Upgrade: " + u.name, (a) => ({ ...a, upgrades: [...a.upgrades, u.id] }));
  }
  function buyCredits(b) {
    setAccount((a) => a ? {
      ...a, credits: a.credits + b.coins,
      history: [{ label: "Coin top-up (" + b.tag + ")", delta: b.coins, ts: Date.now() }, ...a.history]
    } : a);
  }
  function handleLogin(info) {
    setAccount((a) => {
      if (!a) return makeAccount(info);
      return { ...a, name: info.name, email: info.email, color: info.color, guest: info.guest };
    });
    setScreen(prevScreen === "login" ? "landing" : prevScreen);
  }
  function replay() {
    setRoster((r) => r || makeDefaultRoster(settings.name));
    setDemo(null);
    setGameKey((k) => k + 1);
    setScreen("game");
  }
  function jump(target) {
    if (target === "landing") setScreen("landing");
    if (target === "lobby") { setMode("host"); setGameKey((k) => k + 1); setScreen("lobby"); }
    if (target === "game") {
      setRoster((r) => r || makeDefaultRoster(settings.name));
      setDemo(null); setGameKey((k) => k + 1); setScreen("game");
    }
    if (target === "judge") {
      setRoster((r) => r || makeDefaultRoster(settings.name));
      setDemo("judge"); setGameKey((k) => k + 1); setScreen("game");
    }
    if (target === "finale") {
      const ps = makeDefaultRoster(settings.name).map((p, i) => ({ ...p, score: [3, 2, 2, 1, 0][i] }));
      const ans = window.GAME_DATA.answers;
      const prompts = window.GAME_DATA.prompts;
      const hist = [0, 1, 0, 2, 0, 3, 1, 2].map((pi, i) => ({
        round: i + 1, pid: ps[pi].id, name: ps[pi].name,
        answer: ans[(i * 5) % ans.length], prompt: prompts[i % prompts.length]
      }));
      setEndData({ players: ps, history: hist });
      setScreen("end");
    }
  }

  const hasSwapPlus = !!(account && account.upgrades.includes("swapPlus"));

  return (
    <div className="pb-app" style={vars}>
      {screen === "landing" ? (
        <Landing
          account={account}
          onCreate={() => go("create")}
          onJoin={() => { setMode("join"); setGameKey((k) => k + 1); go("lobby"); }}
          onLogin={() => go("login")}
          onProfile={() => go("profile")}
          onHowTo={() => go("howto")}
        />
      ) : null}
      {screen === "howto" ? (
        <HowToPlay
          onBack={() => setScreen(prevScreen === "howto" ? "landing" : prevScreen)}
          onCreate={() => go("create")}
        />
      ) : null}
      {screen === "login" ? (
        <LoginScreen account={account} onDone={handleLogin} onCancel={() => setScreen(prevScreen)} />
      ) : null}
      {screen === "profile" && account ? (
        <ProfileScreen
          account={account}
          onBack={() => setScreen("landing")}
          onStore={() => go("store")}
          onCoins={() => go("coins")}
          onEdit={() => go("login")}
          onLogout={() => { setAccount(null); setScreen("landing"); }}
        />
      ) : null}
      {screen === "profile" && !account ? (
        <LoginScreen account={null} onDone={handleLogin} onCancel={() => setScreen("landing")} />
      ) : null}
      {screen === "store" ? (
        <StoreScreen
          account={account}
          onBack={() => setScreen(prevScreen === "store" ? "landing" : prevScreen)}
          onLogin={() => go("login")}
          onCoins={() => go("coins")}
          buyPack={buyPack}
          buyUpgrade={buyUpgrade}
        />
      ) : null}
      {screen === "coins" ? (
        <CoinsScreen
          account={account}
          onBack={() => setScreen(prevScreen === "coins" ? "landing" : prevScreen)}
          onLogin={() => go("login")}
          buyCredits={buyCredits}
        />
      ) : null}
      {screen === "create" ? (
        <CreateRoom
          initial={settings}
          account={account}
          onBack={() => setScreen("landing")}
          onStore={() => go("store")}
          onCreate={(s) => { setSettings(s); setMode("host"); setGameKey((k) => k + 1); go("lobby"); }}
        />
      ) : null}
      {screen === "lobby" ? (
        <Lobby key={"lobby" + gameKey + mode} mode={mode} settings={settings}
          onLeave={() => setScreen("landing")} onStart={startGame} />
      ) : null}
      {screen === "game" && roster ? (
        <GameScreen key={"game" + gameKey + (demo || "")} roster={roster} settings={settings}
          demo={demo} motion={t.motion}
          swapMax={hasSwapPlus ? Math.max(t.swapMax, 5) : t.swapMax}
          swapEvery={hasSwapPlus ? 2 : 3}
          onEnd={handleEnd} />
      ) : null}
      {screen === "end" && endData ? (
        <EndScreen players={endData.players} history={endData.history} motion={t.motion}
          creditsEarned={endData.earned}
          onReplay={replay} onHome={() => setScreen("landing")} />
      ) : null}

      <ReactionLayer />

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakColor
          label="Palette"
          value={pal.swatch}
          options={Object.keys(PALETTES).map((k) => PALETTES[k].swatch)}
          onChange={(v) => {
            const key = Object.keys(PALETTES).find((k) => PALETTES[k].swatch.join(",") === String(v));
            if (key) setTweak("palette", key);
          }}
        />
        <TweakSlider label="Card corners" value={t.radius} min={6} max={28} unit="px"
          onChange={(v) => setTweak("radius", v)} />
        <TweakSlider label="Motion" value={t.motion} min={0} max={10}
          onChange={(v) => setTweak("motion", v)} />
        <TweakSection label="Gameplay" />
        <TweakSlider label="Cards per swap" value={t.swapMax} min={1} max={7}
          onChange={(v) => setTweak("swapMax", v)} />
        <TweakSection label="Jump to a moment" />
        <TweakButton label="Landing" onClick={() => jump("landing")} />
        <TweakButton label="How to play" onClick={() => go("howto")} />
        <TweakButton label="Lobby" onClick={() => jump("lobby")} />
        <TweakButton label="Gameplay (you play)" onClick={() => jump("game")} />
        <TweakButton label="Judging (you judge)" onClick={() => jump("judge")} />
        <TweakButton label="Finale" onClick={() => jump("finale")} />
        <TweakButton label="Login" onClick={() => go("login")} />
        <TweakButton label="Profile" onClick={() => go("profile")} />
        <TweakButton label="Marketplace" onClick={() => go("store")} />
        <TweakButton label="Coins" onClick={() => go("coins")} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
