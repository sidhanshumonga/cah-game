// Point Blank — end-of-game screen

function RateRound({ motion }) {
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [note, setNote] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const labels = ["", "Meh", "Okay", "Good", "Great", "Hilarious"];
  const shown = hover || rating;

  if (sent) {
    return (
      <div className="rate rate-done">
        <span className="rate-check">✓</span>
        <span className="rate-thanks">Thanks for the feedback!</span>
      </div>
    );
  }
  return (
    <div className="rate">
      <span className="rate-q">How was that game?</span>
      <div className="rate-stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={"rate-star" + (n <= shown ? " rate-star-on" : "")}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            aria-label={n + " star" + (n > 1 ? "s" : "")}
          >
            ★
          </button>
        ))}
      </div>
      <span className="rate-label">{labels[shown] || "\u00A0"}</span>
      {rating ? (
        <div className="rate-followup">
          <input
            className="input rate-input"
            placeholder="Anything to add? (optional)"
            value={note}
            maxLength="120"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") setSent(true); }}
          />
          <Btn onClick={() => setSent(true)}>Send</Btn>
        </div>
      ) : null}
    </div>
  );
}

function EndScreen({ players, history, motion, creditsEarned, onReplay, onHome }) {
  const sorted = React.useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const podium = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
  const heights = sorted.length >= 3 ? [150, 200, 116] : [150, 200];
  const places = sorted.length >= 3 ? ["2nd", "1st", "3rd"] : ["2nd", "1st"];
  const rest = sorted.slice(3);

  const stats = React.useMemo(() => {
    const out = [];
    if (sorted[0]) out.push({ label: "Champion", value: sorted[0].name, detail: sorted[0].score + " points" });
    // longest winning streak
    let best = null, cur = null;
    history.forEach((h) => {
      if (cur && cur.pid === h.pid) cur.len += 1; else cur = { pid: h.pid, name: h.name, len: 1 };
      if (!best || cur.len > best.len) best = { ...cur };
    });
    if (best && best.len > 1) out.push({ label: "Hot streak", value: best.name, detail: best.len + " wins in a row" });
    if (history.length) {
      const line = history[Math.floor(Math.random() * history.length)];
      out.push({ label: "Line of the night", value: "\u201C" + line.answer + "\u201D", detail: "by " + line.name, wide: true });
    }
    return out;
  }, [history, sorted]);

  return (
    <div className="screen endscreen" data-screen-label="Final Results">
      <ConfettiBurst count={Math.round((motion / 10) * 160)} />
      <div className="end-inner">
        <h1 className="end-title">That's the game!</h1>
        <p className="end-sub">{sorted[0] && sorted[0].isYou ? "You are officially the funniest person here." : sorted[0].name + " is officially the funniest person here."}</p>
        {creditsEarned ? (
          <p className="end-earn"><Coin size={16} /> +{creditsEarned} coins earned</p>
        ) : null}

        <div className="podium">
          {podium.map((p, i) => (
            <div key={p.id} className="podium-col" style={{ "--dl": i * 0.18 + 0.2 + "s" }}>
              <Avatar player={p} size={i === 1 ? 64 : 48} judge={i === 1} />
              <span className="podium-name">{p.name}{p.isYou ? " (you)" : ""}</span>
              <span className="podium-pts">{p.score} pts</span>
              <div className="podium-block" style={{ height: heights[i] }}>
                <span className="podium-place">{places[i]}</span>
              </div>
            </div>
          ))}
        </div>

        {rest.length ? (
          <ul className="end-rest">
            {rest.map((p, i) => (
              <li key={p.id} className="end-rest-row">
                <span className="scorerow-rank">{i + 4}</span>
                <Avatar player={p} size={30} />
                <span className="scorerow-name">{p.name}{p.isYou ? " (you)" : ""}</span>
                <span className="scorerow-pts">{p.score}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="end-stats">
          {stats.map((s) => (
            <div key={s.label} className={"stat-card" + (s.wide ? " stat-wide" : "")}>
              <span className="stat-label">{s.label}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-detail">{s.detail}</span>
            </div>
          ))}
        </div>

        <RateRound motion={motion} />

        <div className="end-actions">
          <Btn big={true} onClick={onReplay}>Play again</Btn>
          <Btn big={true} variant="secondary" onClick={onHome}>Back to start</Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EndScreen, RateRound });
