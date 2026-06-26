import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize firebase-admin.
// It will automatically use the emulator if FIRESTORE_EMULATOR_HOST is set.
initializeApp({
  projectId: "test-cah"
});

const db = getFirestore();

const classicPack = {
  id: "classic",
  name: "Classic",
  free: true,
  price: 0,
  familyFriendly: true,
  cards: 21,
  prompts: [
    "My secret talent is ____.",
    "The secret ingredient in every bad decision is ____.",
    "Nothing kills the mood faster than ____.",
    "Rejected ice cream flavor: ____.",
    "The worst thing to hear during a job interview is ____."
  ],
  answers: [
    "a haunted Roomba",
    "one single crouton",
    "An aggressively honest PowerPoint presentation.",
    "Making every situation slightly worse.",
    "Competitive overthinking.",
    "Pretending to know what I'm doing.",
    "Free tequila.",
    "Accidentally calling them 'bro'.",
    "An emotional support raccoon.",
    "Going viral for the wrong reason.",
    "An aggressively loud yawn.",
    "A disappointed sigh.",
    "Self-diagnosing on WebMD.",
    "Competitive eating as a coping mechanism.",
    "A really bad tattoo.",
    "Aggressive interpretive dance.",
    "Twenty-seven browser tabs, all playing audio.",
    "Expressing emotion through memes.",
    "Gaslighting myself into productivity.",
    "Over-caffeinated existential dread.",
    "A PowerPoint presentation on my feelings."
  ]
};

async function seed() {
  console.log('[Seed] Connecting to Firestore Emulator and seeding classic pack using Admin SDK...');
  try {
    await db.collection('packages').doc('classic').set({
      ...classicPack,
      createdBy: 'emulator-seed',
      createdAt: new Date().getTime()
    });
    console.log('[Seed] ✓ Classic pack successfully seeded to Firestore Emulator!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed] ✗ Failed to seed classic pack:', err);
    process.exit(1);
  }
}

seed();
