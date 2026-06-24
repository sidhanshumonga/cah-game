// Point Blank — core gameplay screen (pick → submit → judge → reveal)

function shuffleArr(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = x[i]; x[i] = x[j]; x[j] = tmp;
  }
  return x;
}
function makeDraw(arr) {
  let pool = shuffleArr(arr);
  return () => {
    if (!pool.length) pool = shuffleArr(arr);
    return pool.pop();
  };
}

function GameScreen({ roster, settings, demo, motion, swapMax, swapEvery, onEnd }) {
  const maxSwap = swapMax || 3;
  const every = swapEvery || 3;
  const n = roster.length;
  const [players, setPlayers] = React.useState(() =>
    demo === "judge"
      ? roster.map((p, i) => ({ ...p, score: [0, 2, 1, 2, 1][i % 5] }))
      : roster.map((p) => ({ ...p, score: 0 }))
  );
  const drawA = React.useRef(null);
  if (!drawA.current) drawA.current = makeDraw(window.GAME_DATA.answers);
  const drawP = React.useRef(null);
  if (!drawP.current) drawP.current = makeDraw(window.GAME_DATA.prompts);
  const historyRef = React.useRef([]);

  const [roundNum, setRoundNum] = React.useState(demo === "judge" ? 3 : 1);
  const [prompt, setPrompt] = React.useState(() => drawP.current());
  const [hand, setHand] = React.useState(() => Array.from({ length: 7 }, () => drawA.current()));
  const [subs, setSubs] = React.useState([]);
  const [myPick, setMyPick] = React.useState(null);
  const [mySubmitted, setMySubmitted] = React.useState(false);
  const [phase, setPhase] = React.useState("pick");
  const [flipped, setFlipped] = React.useState(false);
  const [winnerPid, setWinnerPid] = React.useState(null);
  const [scoresOpen, setScoresOpen] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState(settings.timer);
  const [swapMode, setSwapMode] = React.useState(false);
  const [swapPicks, setSwapPicks] = React.useState([]);
  const [swapsUsed, setSwapsUsed] = React.useState(0);

  const judgeIdx = React.useMemo(() => {
    if (demo === "judge") return players.findIndex((p) => p.isYou);
    const order = [1, 0].concat(Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 2));
    return order[(roundNum - 1) % n];
  }, [roundNum, n, demo]);
  const judge = players[judgeIdx];
  const youAreJudge = !!judge.isYou;
  const you = players.find((p) => p.isYou);
  const needed = n - 1;
  const firstRound = React.useRef(true);

  /* New round setup */
  React.useEffect(() => {
    if (firstRound.current) { firstRound.current = false; return; }
    setPrompt(drawP.current());
    setHand(Array.from({ length: 7 }, () => drawA.current()));
    setSubs([]);
    setMyPick(null);
    setMySubmitted(false);
    setWinnerPid(null);
    setFlipped(false);
    setPhase("pick");
    setTimeLeft(settings.timer);
    setSwapMode(false);
    setSwapPicks([]);
  }, [roundNum]);

  /* Bots submit on their own schedule */
  React.useEffect(() => {
    if (phase !== "pick") return;
    const timers = players
      .filter((p) => p.isBot && p.id !== judge.id)
      .map((p, i) =>
        setTimeout(() => {
          setSubs((s) => (s.some((x) => x.pid === p.id) ? s : [...s, { pid: p.id, text: drawA.current() }]));
        }, 1400 + Math.random() * 4800 + i * 500)
      );
    return () => timers.forEach(clearTimeout);
  }, [phase, roundNum]);

  /* All in -> shuffle, move to judging */
  React.useEffect(() => {
    if (phase !== "pick" || subs.length < needed) return;
    const t = setTimeout(() => {
      setSubs((s) => shuffleArr(s));
      setPhase("judging");
    }, 800);
    return () => clearTimeout(t);
  }, [subs, phase, needed]);

  /* Flip cards shortly after judging starts */
  React.useEffect(() => {
    if (phase !== "judging") return;
    const t = setTimeout(() => setFlipped(true), 120);
    return () => clearTimeout(t);
  }, [phase]);

  /* Countdown timer while you pick */
  React.useEffect(() => {
    if (phase !== "pick" || youAreJudge || mySubmitted) return;
    if (timeLeft <= 0) {
      if (hand.length) submitCard(myPick || hand[Math.floor(Math.random() * hand.length)]);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, youAreJudge, mySubmitted]);

  /* Bot judge decides */
  React.useEffect(() => {
    if (phase !== "judging" || youAreJudge) return;
    const flipTime = subs.length * 420 + 900;
    const t = setTimeout(() => {
      const mine = subs.find((s) => s.pid === "you");
      const pick = mine && Math.random() < 0.45 ? mine : subs[Math.floor(Math.random() * subs.length)];
      crown(pick.pid);
    }, flipTime + 2200);
    return () => clearTimeout(t);
  }, [phase, youAreJudge]);

  /* Bots react during the reveal */
  React.useEffect(() => {
    if (phase !== "reveal") return;
    const R = window.GAME_DATA.reactions;
    const timers = Array.from({ length: 6 }, (_, i) =>
      setTimeout(() => spawnReaction(R[Math.floor(Math.random() * R.length)]), 700 + i * 460 + Math.random() * 320)
    );
    return () => timers.forEach(clearTimeout);
  }, [phase]);

  function submitCard(text) {
    if (!text) return;
    setMySubmitted(true);
    setMyPick(text);
    setSwapMode(false);
    setSwapPicks([]);
    setSubs((s) => (s.some((x) => x.pid === "you") ? s : [...s, { pid: "you", text: text }]));
  }

  /* Card swaps: one credit earned every N completed rounds */
  const swapCredits = Math.floor((roundNum - 1) / every) - swapsUsed;
  const canSwap = swapCredits > 0;
  const nextSwapRound = every * (swapsUsed + 1) + 1;
  function toggleSwapPick(i) {
    setSwapPicks((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < maxSwap ? [...s, i] : s));
  }
  function doSwap() {
    if (!swapPicks.length) return;
    setHand((h) => h.map((c, i) => (swapPicks.includes(i) ? drawA.current() : c)));
    setSwapsUsed((u) => u + 1);
    setSwapMode(false);
    setSwapPicks([]);
  }

  function crown(pid) {
    setSubs((curSubs) => {
      const winnerSub = curSubs.find((s) => s.pid === pid);
      setPlayers((cur) => {
        const updated = cur.map((p) => (p.id === pid ? { ...p, score: p.score + 1 } : p));
        const w = updated.find((p) => p.id === pid);
        historyRef.current.push({ round: roundNum, pid: pid, name: w.name, answer: winnerSub ? winnerSub.text : "", prompt: prompt });
        return updated;
      });
      return curSubs;
    });
    setWinnerPid(pid);
    setPhase("reveal");
  }

  const maxScore = Math.max.apply(null, players.map((p) => p.score));
  const gameOver = maxScore >= settings.scoreLimit;
  function next() {
    if (gameOver) onEnd(players, historyRef.current);
    else setRoundNum((r) => r + 1);
  }

  const winner = players.find((p) => p.id === winnerPid);
  const winnerSub = subs.find((s) => s.pid === winnerPid);
  const nonJudge = players.filter((p) => p.id !== judge.id);
  const submittedIds = subs.map((s) => s.pid);
  const mid = (hand.length - 1) / 2;

  return (
    <div className="screen game" data-screen-label={"Game — " + phase}>
      <TopBar
        code="GRUV"
        round={roundNum}
        players={players}
        judge={judge}
        you={you}
        limit={settings.scoreLimit}
        onScores={() => setScoresOpen(true)}
      />
      <ScorePanel open={scoresOpen} onClose={() => setScoresOpen(false)} players={players} limit={settings.scoreLimit} />
      <SideScores players={players} judgeId={judge.id} limit={settings.scoreLimit} />

      {/* ---------- PICK ---------- */}
      {phase === "pick" && !youAreJudge ? (
        <main className="game-main">
          {!mySubmitted ? <TimerBar seconds={timeLeft} total={settings.timer} /> : null}
          <div className="stage">
            <PromptCard text={prompt} className="stage-prompt" />
            <div className="status-row">
              {nonJudge.map((p) => (
                <Avatar key={p.id} player={p} size={34} done={submittedIds.includes(p.id)} dim={!submittedIds.includes(p.id)} />
              ))}
            </div>
          </div>

          {!mySubmitted ? (
            <React.Fragment>
              <div className="hand-toolbar">
                <p className="hand-hint">
                  {swapMode
                    ? "Select up to " + maxSwap + " cards to replace (" + swapPicks.length + " picked)"
                    : myPick ? "Locked and loaded?" : "Pick your funniest card"}
                </p>
                {!swapMode ? (
                  <button
                    className={"swapbtn" + (canSwap ? "" : " swapbtn-off")}
                    disabled={!canSwap}
                    onClick={() => { setSwapMode(true); setMyPick(null); }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"></path><path d="M21 3v5h-5"></path></svg>
                    {canSwap
                      ? "Swap cards" + (swapCredits > 1 ? " (" + swapCredits + ")" : "")
                      : roundNum <= every
                        ? "Swaps unlock after round " + every
                        : "Next swap in " + (nextSwapRound - roundNum) + " round" + (nextSwapRound - roundNum > 1 ? "s" : "")}
                  </button>
                ) : null}
              </div>
              <div className="hand">
                {hand.map((c, i) => (
                  <div
                    key={c + i}
                    className="hand-slot"
                    style={{ "--rot": (i - mid) * 4 + "deg", "--ty": Math.abs(i - mid) * 9 + "px", "--dl": i * 70 + "ms" }}
                  >
                    <AnswerCard
                      text={c}
                      selected={!swapMode && myPick === c}
                      className={swapMode && swapPicks.includes(i) ? "acard-swapsel" : ""}
                      onClick={() => (swapMode ? toggleSwapPick(i) : setMyPick(myPick === c ? null : c))}
                    />
                  </div>
                ))}
              </div>
              <div className={"confirm-bar" + (swapMode || myPick ? " confirm-show" : "")}>
                {swapMode ? (
                  <div className="swap-actions">
                    <Btn big={true} variant="accent" disabled={!swapPicks.length} onClick={doSwap}>
                      Replace {swapPicks.length || ""} card{swapPicks.length === 1 ? "" : "s"}
                    </Btn>
                    <Btn big={true} variant="secondary" onClick={() => { setSwapMode(false); setSwapPicks([]); }}>Cancel</Btn>
                  </div>
                ) : (
                  <Btn big={true} variant="accent" onClick={() => submitCard(myPick)}>Lock it in</Btn>
                )}
              </div>
            </React.Fragment>
          ) : (
            <div className="waiting-area">
              <div className="pile">
                {subs.map((s, i) => (
                  <div key={s.pid} className="pile-slot" style={{ "--r": ((i % 5) - 2) * 5 + "deg" }}>
                    <FlipCard text={s.text} flipped={false} />
                  </div>
                ))}
              </div>
              <p className="waiting-text">
                Card in. Waiting on {needed - subs.length} more<span className="dots"><i>.</i><i>.</i><i>.</i></span>
              </p>
            </div>
          )}
        </main>
      ) : null}

      {/* ---------- COLLECT (you are judge) ---------- */}
      {phase === "pick" && youAreJudge ? (
        <main className="game-main">
          <div className="judge-banner">
            <span className="judge-banner-crown"><CrownIcon /></span>
            You're the judge this round — sit back while everyone scrambles
          </div>
          <div className="stage">
            <PromptCard text={prompt} className="stage-prompt" />
            <div className="status-row">
              {nonJudge.map((p) => (
                <Avatar key={p.id} player={p} size={34} done={submittedIds.includes(p.id)} dim={!submittedIds.includes(p.id)} />
              ))}
            </div>
          </div>
          <div className="waiting-area">
            <div className="pile">
              {subs.map((s, i) => (
                <div key={s.pid} className="pile-slot" style={{ "--r": ((i % 5) - 2) * 5 + "deg" }}>
                  <FlipCard text={s.text} flipped={false} />
                </div>
              ))}
            </div>
            <p className="waiting-text">
              {subs.length} of {needed} answers in<span className="dots"><i>.</i><i>.</i><i>.</i></span>
            </p>
          </div>
        </main>
      ) : null}

      {/* ---------- JUDGING ---------- */}
      {phase === "judging" ? (
        <main className="game-main">
          <div className="stage stage-judging">
            <PromptCard text={prompt} small={true} className="stage-prompt" />
            <h2 className="judging-title">
              {youAreJudge ? "Pick the funniest answer" : (
                <React.Fragment>{judge.name} is deciding<span className="dots"><i>.</i><i>.</i><i>.</i></span></React.Fragment>
              )}
            </h2>
          </div>
          <div className="judge-grid">
            {subs.map((s, i) => (
              <FlipCard
                key={s.pid}
                text={s.text}
                flipped={flipped}
                delay={i * 0.42 + "s"}
                clickable={youAreJudge && flipped}
                onClick={() => crown(s.pid)}
              />
            ))}
          </div>
          {youAreJudge ? <p className="judging-hint">Answers are anonymous — tap a card to crown the winner</p> : null}
        </main>
      ) : null}

      {/* ---------- REVEAL ---------- */}
      {phase === "reveal" && winner ? (
        <main className="game-main reveal">
          <ConfettiBurst count={Math.round((motion / 10) * 110)} />
          <div className="winbanner">
            <Avatar player={winner} size={56} />
            <div className="winbanner-text">
              <span className="winbanner-name">{winner.isYou ? "You win the round!" : winner.name + " wins the round!"}</span>
              <span className="winbanner-sub">crowned by {judge.isYou ? "you" : judge.name}</span>
            </div>
            <span className="plusone">+1</span>
          </div>
          <PromptCard text={prompt} fill={winnerSub ? winnerSub.text : ""} className="reveal-prompt" />
          <div className="reveal-others">
            {subs.filter((s) => s.pid !== winnerPid).map((s) => (
              <AnswerCard key={s.pid} text={s.text} small={true} dimmed={true} />
            ))}
          </div>
          <div className="reveal-foot">
            <ReactionBar />
            <Btn big={true} onClick={next}>{gameOver ? "See final results" : "Next round"}</Btn>
          </div>
        </main>
      ) : null}
    </div>
  );
}

Object.assign(window, { GameScreen, shuffleArr, makeDraw });
