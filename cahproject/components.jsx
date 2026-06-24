// Point Blank — shared UI components

const CONFETTI_COLORS = ["#FF5C39", "#FFC93C", "#7C5CFF", "#2BC4BE", "#FF4D8D", "#5CA9FF"];

/* ---------- Logo ---------- */
function Logo({ big }) {
  return (
    <span className={"logo" + (big ? " logo-big" : "")}>
      cards against <span className="logo-card">humanity</span>
    </span>
  );
}

/* ---------- Button ---------- */
function Btn({ variant, children, onClick, disabled, className, big }) {
  return (
    <button
      className={
        "btn " + (variant || "primary") + (big ? " btn-big" : "") + (className ? " " + className : "")
      }
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/* ---------- Coin ---------- */
function Coin({ size }) {
  const s = size || 14;
  return (
    <svg className="coin" width={s} height={s} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="var(--accent2)"></circle>
      <circle cx="10" cy="10" r="6" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.6"></circle>
      <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.4"></circle>
    </svg>
  );
}

function LockIcon({ size }) {
  const s = size || 12;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17 10V7a5 5 0 0 0-10 0v3H5v12h14V10h-2zm-8-3a3 3 0 0 1 6 0v3H9V7z"></path>
    </svg>
  );
}

/* ---------- Avatar ---------- */
function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.6 10H4.6L3 8z"></path>
    </svg>
  );
}

function Avatar({ player, size, judge, done, dim }) {
  const s = size || 40;
  return (
    <span
      className={"avatar" + (dim ? " avatar-dim" : "")}
      style={{ width: s, height: s, background: player.color, fontSize: s * 0.42 }}
      title={player.name}
    >
      {player.name[0]}
      {judge ? (
        <span className="avatar-badge avatar-crown"><CrownIcon /></span>
      ) : null}
      {done ? <span className="avatar-badge avatar-check">✓</span> : null}
    </span>
  );
}

/* ---------- Prompt text with styled blanks ---------- */
function PromptText({ text, fill }) {
  const parts = text.split("____");
  return (
    <React.Fragment>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {p}
          {i < parts.length - 1 ? (
            fill ? <span className="blank-fill">{fill}</span> : <span className="blank"></span>
          ) : null}
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

function PromptCard({ text, fill, small, className }) {
  return (
    <div className={"pcard" + (small ? " pcard-small" : "") + (className ? " " + className : "")}>
      <div className="pcard-text"><PromptText text={text} fill={fill} /></div>
      <div className="card-foot"><Logo /></div>
    </div>
  );
}

/* ---------- Answer card (face up) ---------- */
function AnswerCard({ text, selected, dimmed, winner, small, onClick, className, style }) {
  const cls =
    "acard" +
    (selected ? " acard-selected" : "") +
    (dimmed ? " acard-dimmed" : "") +
    (winner ? " acard-winner" : "") +
    (small ? " acard-small" : "") +
    (className ? " " + className : "");
  if (onClick) {
    return (
      <button className={cls} style={style} onClick={onClick}>
        <span className="acard-text">{text}</span>
        <span className="card-foot card-foot-light"><Logo /></span>
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      <span className="acard-text">{text}</span>
      <span className="card-foot card-foot-light"><Logo /></span>
    </div>
  );
}

/* ---------- Flip card (face-down -> face-up) for judging ---------- */
function FlipCard({ text, flipped, winner, dimmed, onClick, delay, clickable }) {
  const inner = (
    <span className="flip-inner" style={{ transitionDelay: flipped && delay ? delay : "0s" }}>
      <span className="flip-face flip-back">
        <span className="flip-mark">cah<span className="flip-dot">.</span></span>
      </span>
      <span className="flip-face flip-front">
        <span className="acard-text">{text}</span>
      </span>
    </span>
  );
  const cls =
    "flipwrap" +
    (flipped ? " is-flipped" : "") +
    (winner ? " flip-winner" : "") +
    (dimmed ? " flip-dimmed" : "");
  if (clickable) {
    return <button className={cls} onClick={onClick}>{inner}</button>;
  }
  return <div className={cls}>{inner}</div>;
}

/* ---------- Confetti ---------- */
function ConfettiBurst({ count }) {
  const pieces = React.useMemo(() => {
    const n = Math.max(0, count == null ? 120 : count);
    return Array.from({ length: n }, (_, i) => ({
      x: Math.random() * 100,
      dur: 1.4 + Math.random() * 1.8,
      delay: Math.random() * 0.5,
      rot: 200 + Math.random() * 520,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 8,
      drift: -60 + Math.random() * 120,
      round: Math.random() > 0.7
    }));
  }, [count]);
  if (!pieces.length) return null;
  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: p.x + "%",
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            borderRadius: p.round ? "50%" : "1px",
            background: p.color,
            animationDuration: p.dur + "s",
            animationDelay: p.delay + "s",
            "--rot": p.rot + "deg",
            "--drift": p.drift + "px"
          }}
        ></span>
      ))}
    </div>
  );
}

/* ---------- Floating emoji reactions ---------- */
function spawnReaction(emoji, x) {
  window.dispatchEvent(
    new CustomEvent("spawn-reaction", { detail: { emoji: emoji, x: x } })
  );
}

function ReactionLayer() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    const handler = (e) => {
      const id = Math.random().toString(36).slice(2);
      const item = {
        id: id,
        emoji: e.detail.emoji,
        x: e.detail.x != null ? e.detail.x : 12 + Math.random() * 76,
        drift: -30 + Math.random() * 60
      };
      setItems((s) => [...s, item]);
      setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 2600);
    };
    window.addEventListener("spawn-reaction", handler);
    return () => window.removeEventListener("spawn-reaction", handler);
  }, []);
  return (
    <div className="reaction-layer" aria-hidden="true">
      {items.map((i) => (
        <span key={i.id} className="float-emoji" style={{ left: i.x + "%", "--drift": i.drift + "px" }}>
          {i.emoji}
        </span>
      ))}
    </div>
  );
}

function ReactionBar() {
  return (
    <div className="reaction-bar">
      {window.GAME_DATA.reactions.map((r) => (
        <button key={r} className="reaction-btn" onClick={() => spawnReaction(r)}>
          {r}
        </button>
      ))}
    </div>
  );
}

/* ---------- Timer bar ---------- */
function TimerBar({ seconds, total }) {
  const pct = Math.max(0, (seconds / total) * 100);
  return (
    <div className={"timerbar" + (seconds <= 10 ? " timerbar-low" : "")}>
      <div className="timerbar-fill" style={{ width: pct + "%" }}></div>
      <span className="timerbar-num">{seconds}s</span>
    </div>
  );
}

/* ---------- Top bar ---------- */
function TopBar({ code, round, players, judge, you, limit, onScores }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <Logo />
        <span className="chip chip-code">{code}</span>
      </div>
      <div className="topbar-mid">
        {round ? <span className="topbar-round">Round {round}</span> : null}
        {judge ? (
          <span className="topbar-judge">
            <Avatar player={judge} size={22} /> {judge.isYou ? "You are" : judge.name + " is"} judging
          </span>
        ) : null}
      </div>
      <div className="topbar-right">
        <button className="chip chip-score" onClick={onScores}>
          <span className="chip-score-dot" style={{ background: you.color }}></span>
          {you.score} / {limit} pts
        </button>
      </div>
    </header>
  );
}

/* ---------- Persistent in-game score rail ---------- */
function SideScores({ players, judgeId, limit }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top = sorted[0] ? sorted[0].score : 0;
  return (
    <aside className="sidescores">
      <span className="ss-title">Scores</span>
      {sorted.map((p) => (
        <div key={p.id} className={"ss-row" + (p.isYou ? " ss-you" : "")}>
          <Avatar player={p} size={28} judge={p.id === judgeId} />
          <span className="ss-name">{p.name}{p.isYou ? " (you)" : ""}</span>
          <span key={p.score} className={"ss-pts" + (p.score === top && top > 0 ? " ss-lead" : "")}>{p.score}</span>
        </div>
      ))}
      <span className="ss-goal">first to {limit} wins</span>
    </aside>
  );
}

/* ---------- Scoreboard slide-over ---------- */
function ScorePanel({ open, onClose, players, limit }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <React.Fragment>
      <div className={"scrim" + (open ? " scrim-open" : "")} onClick={onClose}></div>
      <aside className={"scorepanel" + (open ? " scorepanel-open" : "")}>
        <div className="scorepanel-head">
          <h3>Leaderboard</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="scorepanel-sub">First to {limit} points wins</p>
        <ul className="scorelist">
          {sorted.map((p, i) => (
            <li key={p.id} className="scorerow">
              <span className="scorerow-rank">{i + 1}</span>
              <Avatar player={p} size={34} />
              <span className="scorerow-name">{p.name}{p.isYou ? " (you)" : ""}</span>
              <span className="scorerow-bar">
                <span
                  className="scorerow-fill"
                  style={{ width: Math.min(100, (p.score / limit) * 100) + "%", background: p.color }}
                ></span>
              </span>
              <span className="scorerow-pts">{p.score}</span>
            </li>
          ))}
        </ul>
      </aside>
    </React.Fragment>
  );
}

Object.assign(window, {
  CONFETTI_COLORS, Logo, Btn, Avatar, CrownIcon, Coin, LockIcon, PromptText, PromptCard, AnswerCard,
  FlipCard, ConfettiBurst, ReactionLayer, ReactionBar, spawnReaction, TimerBar, TopBar, ScorePanel, SideScores
});
