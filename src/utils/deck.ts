function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return function() {
    h = Math.imul(1664525, h) + 1013904223 | 0;
    return (h >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const rand = seededRandom(seed);
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export function buildSeededDeck(
  selectedPackIds: string[],
  packs: any[],
  family: boolean,
  seed: string
) {
  const activePacks = packs.filter(p => selectedPackIds.includes(p.id) && !(family && p.familyFriendly === false));
  
  // Seeded shuffle each pack's prompts/answers separately
  const promptsByPack = activePacks.map(p => seededShuffle<string>(p.prompts || [], `${seed}-prompts-${p.id}`));
  const answersByPack = activePacks.map(p => seededShuffle<string>(p.answers || [], `${seed}-answers-${p.id}`));

  const promptsPool: string[] = [];
  const answersPool: string[] = [];

  let hasMorePrompts = true;
  let promptPointers = promptsByPack.map(() => 0);
  while (hasMorePrompts) {
    hasMorePrompts = false;
    for (let i = 0; i < promptsByPack.length; i++) {
      if (promptPointers[i] < promptsByPack[i].length) {
        promptsPool.push(promptsByPack[i][promptPointers[i]]);
        promptPointers[i]++;
        hasMorePrompts = true;
      }
    }
  }

  let hasMoreAnswers = true;
  let answerPointers = answersByPack.map(() => 0);
  while (hasMoreAnswers) {
    hasMoreAnswers = false;
    for (let i = 0; i < answersByPack.length; i++) {
      if (answerPointers[i] < answersByPack[i].length) {
        answersPool.push(answersByPack[i][answerPointers[i]]);
        answerPointers[i]++;
        hasMoreAnswers = true;
      }
    }
  }

  if (promptsPool.length === 0) promptsPool.push("Draw a card.");
  if (answersPool.length === 0) answersPool.push("A card.");

  return { prompts: promptsPool, answers: answersPool };
}

export function getPromptForRound(arr: string[], seed: string, round: number): string {
  const deckSize = arr.length;
  const cycle = Math.floor((round - 1) / deckSize) + 1;
  const index = (round - 1) % deckSize;
  const shuffled = cycle === 1 ? arr : seededShuffle(arr, `${seed}-prompts-cycle-${cycle}`);
  // Pop from end: index from end
  return shuffled[shuffled.length - 1 - index] || arr[0];
}
