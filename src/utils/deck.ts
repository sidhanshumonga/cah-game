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

// A comprehensive, case-insensitive blacklist of mature terms, profanities, anatomical words, and suggestive keywords
const MATURE_BLACKBOX: RegExp[] = [
  // Profanities and variations
  /\bfuck(ing|er|ed|s)?\b/i,
  /\bshit(ting|ted|s|ty)?\b/i,
  /\bbitch(es|y)?\b/i,
  /\bass(hole|es|y)?\b/i,
  /\bcunt(s)?\b/i,
  /\bcock(s)?\b/i,
  /\bpuss(y|ies)?\b/i,
  /\bdick(s|head)?\b/i,
  /\bprick(s)?\b/i,
  /\bwank(er|ers|ing)?\b/i,
  /\bbastard(s)?\b/i,
  /\bmotherfuck(er|ers|ing)?\b/i,
  
  // Sexual and suggestive terms
  /\bsex(ual|y|ualized|ed|ing)?\b/i,
  /\bpenis(es)?\b/i,
  /\bvagina(s)?\b/i,
  /\borgasm(s)?\b/i,
  /\bsemen\b/i,
  /\bmasturbat(e|ing|ion)\b/i,
  /\bporn(ography|o|star|stars)?\b/i,
  /\berect(ion|ions)?\b/i,
  /\bclitoris\b/i,
  /\btesticle(s)?\b/i,
  /\bball(sack|sacks)?\b/i,
  /\bboob(s|ies)?\b/i,
  /\btit(s|ties)?\b/i,
  /\bintercourse\b/i,
  /\bcoitus\b/i,
  /\bprostitut(e|es|ion)\b/i,
  /\bhooker(s)?\b/i,
  /\bstripper(s)?\b/i,
  /\bcondom(s)?\b/i,
  /\bbdsm\b/i,
  /\bfetish(es)?\b/i,
  /\borgy\b/i,
  /\borgies\b/i,
  /\brape(d|s|ist|ists)?\b/i,
  /\bincest\b/i,
  /\bpedophil(e|ia|es)\b/i,
  /\blust\b/i,
  /\bhorny\b/i,
  /\bejactulat(e|ed|ion)\b/i,
  /\bnude(s|ity)?\b/i,
  /\bnaked\b/i,
  /\bthreesome(s)?\b/i,

  // Illicit drugs and substances
  /\bcocaine\b/i,
  /\bheroin\b/i,
  /\bmeth(amphetamine)?\b/i,
  /\bmarijuana\b/i,
  /\bweed\b/i,
  /\becstasy\b/i,
  /\blsd\b/i,
  /\bstoned\b/i,
  /\bhigh\b/i, // matched as word boundary to avoid high-score, etc.
  /\boverdose(d)?\b/i,
  /\bdrug(s|gy|ged)?\b/i,
  
  // Graphic violence and weapons
  /\bsuicide(s)?\b/i,
  /\bmurder(ed|er|s|ing)?\b/i,
  /\bhomicide\b/i,
  /\bkill(ed|er|s|ing)?\b/i,
  /\bassault(ed|s|ing)?\b/i,
  /\bterrorist(s|m)?\b/i,
  /\btorture(d|s|ing)?\b/i,
  /\bshoot(ing|er|ers|s)?\b/i,
  /\bstab(bed|bing|s)?\b/i,
  /\bbloody\b/i,
  /\bexecution(er|ers)?\b/i
];

function isSafeText(text: string): boolean {
  if (!text) return true;
  const cleanStr = text.toLowerCase();
  return !MATURE_BLACKBOX.some(pattern => pattern.test(cleanStr));
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

  let promptsPool: string[] = [];
  let answersPool: string[] = [];

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

  // If family-friendly mode is active, filter individual cards in the classic/base decks
  if (family) {
    promptsPool = promptsPool.filter(text => isSafeText(text));
    answersPool = answersPool.filter(text => isSafeText(text));
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
