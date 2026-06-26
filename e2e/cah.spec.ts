import { test, expect } from '@playwright/test';

// Helper to mock Canny posts
const mockCannyPosts = {
  posts: [
    {
      id: 'post-test-1',
      title: 'Make a dark mode option',
      details: 'A dark mode would look amazing and be easier on the eyes.',
      category: { name: 'Feature' },
      status: 'planned',
      score: 42,
      commentCount: 3,
      created: new Date().toISOString(),
      author: {
        id: 'mock-user-123',
        name: 'Jane Doe',
      },
    },
  ],
};

test.describe('Cards Against Humanity - E2E Testing Suite', () => {
  // Scenario 1: Landing page loading and header navigation
  test('Scenario 1: Landing Page and Rules Navigation', async ({ page }) => {
    // Navigate to landing page
    await page.goto('/');

    // Check title/logo and tagline
    await expect(page.locator('.tagline')).toContainText('party game for people with questionable friends');

    // Click on Rules nav link
    await page.click('button:has-text("Rules")');
    await page.waitForURL('**/howto');

    // Verify rules content
    await expect(page.locator('.howto-title')).toContainText('How to play');
    await expect(page.locator('.howto-step-title').first()).toContainText('Gather your crew');

    // Click Back arrow to return to landing page
    await page.click('button[aria-label="Back"]');
    await page.waitForURL('**/');

    // Verify we are back on landing page
    await expect(page.locator('.tagline')).toBeVisible();
  });

  // Scenario 2: Guest safeguards on /feedback
  test('Scenario 2: Guest Safeguards on Feedback Page', async ({ page }) => {
    // Intercept Canny API calls to return mock posts
    await page.route('**/api/canny/posts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCannyPosts),
      });
    });

    // Navigate to feedback page
    await page.goto('/feedback');

    // Verify feedback board page loaded
    await expect(page.locator('.fb-title')).toContainText('Feedback & Roadmap');

    // Verify mock post is rendered
    await expect(page.locator('.fb-post-title').first()).toContainText('Make a dark mode option');

    // Scenario 2a: Click Suggest something as guest -> expect auth required modal
    await page.click('button:has-text("Suggest something")');

    // Verify auth modal popup
    const authModal = page.locator('div[role="dialog"][aria-label="Google login required"]');
    await expect(authModal).toBeVisible();
    await expect(authModal.locator('h3')).toContainText('Google Login Required');

    // Dismiss the modal
    await authModal.locator('button:has-text("Cancel")').click();
    await expect(authModal).not.toBeVisible();

    // Scenario 2b: Click upvote on mock post as guest -> expect auth required modal
    await page.locator('button.fb-vote').first().click();
    await expect(authModal).toBeVisible();

    // Dismiss the modal again
    await authModal.locator('button:has-text("Cancel")').click();
    await expect(authModal).not.toBeVisible();
  });

  // Scenario 3, 4, 5: Custom Room Setup, Lobby Bots Syncing, and Gameplay loop
  test('Scenario 3, 4 & 5: Complete Room Creation, Lobby Bots and Gameplay loop', async ({ page }) => {
    // Increase test timeout for the gameplay loop to accommodate bot action delays
    test.setTimeout(60000);

    // 1. Navigate to create room page
    await page.goto('/create');
    await expect(page.locator('.create-title')).toContainText('Set up your room');

    // 2. Set Name
    const nameInput = page.locator('input.input').first();
    await nameInput.fill('Host Player');

    // 3. Set Point Limit to 1 to end game in a single round
    // Seg options correspond to [1, 3, 5, 7], click the '1' button
    const pointLimitBtn = page.locator('button.seg-btn:has-text("1")');
    await pointLimitBtn.click();

    // 4. Set Bots count to 2 (satisfies >= 2 players needed for start button)
    // Find the Bots slider and set its value to 2
    const botsSlider = page.locator('input[type="range"]').nth(1);
    await botsSlider.fill('2');

    // 5. Create room
    await page.click('button:has-text("Create room")');

    // Wait for transition to lobby
    await page.waitForURL(/\/lobby\/[A-Z]{4}/, { timeout: 15000 });
    const code = page.url().split('/').pop() || '';
    console.log(`Successfully created room with code: ${code}`);

    // Wait for the bots to sync and join the lobby roster
    // Need at least 2 bots to join so total players = 3 (1 host + 2 bots)
    // The "Start game" button becomes enabled when canStart is true (roomPlayers.length >= 2)
    const startGameBtn = page.locator('button:has-text("Start game")');
    await startGameBtn.waitFor({ state: 'visible', timeout: 15000 });

    // Click "Start game" to start game
    await startGameBtn.click();

    // Wait for navigation to game arena
    await page.waitForURL(/\/game\/[A-Z]{4}/, { timeout: 15000 });
    await expect(page.locator('.topbar')).toBeVisible();

    // Wait for either the hand cards (if we are a normal player) or the judge banner (if we are the judge)
    const cards = page.locator('.hand button.acard');
    const hand = page.locator('.hand');
    const judgeBanner = page.locator('.judge-banner');
    
    await Promise.race([
      hand.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {}),
      judgeBanner.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
    ]);

    // Determine if the player is the judge or a normal player this round
    const isJudge = await judgeBanner.isVisible();

    if (isJudge) {
      console.log('[E2E Gameplay] Human is the judge. Waiting for bots to submit...');
      // Flipped submissions should appear and be clickable
      const flippedCards = page.locator('button.flipwrap.is-flipped');
      await flippedCards.first().waitFor({ state: 'visible', timeout: 20000 });

      // Click the first card to select it as the winning card
      await flippedCards.first().click();
    } else {
      console.log('[E2E Gameplay] Human is normal player. Selecting card from hand...');
      await cards.first().click();

      // Click "Lock it in"
      await page.click('button:has-text("Lock it in")');
      console.log('[E2E Gameplay] Human card locked in. Waiting for bot judge to decide...');
    }

    // Since score limit is 1, the winner of this round ends the game
    // The "See final results" button should be displayed on reveal phase
    const resultsBtn = page.locator('button:has-text("See final results")');
    await resultsBtn.waitFor({ state: 'visible', timeout: 25000 });
    await resultsBtn.click();

    // Verify transition to final results page
    await page.waitForURL(/\/end$/, { timeout: 10000 });
    await expect(page.locator('.end-title')).toContainText("That's the game!");

    // Rating star feedback flow: click 5th star (Hilarious)
    const stars = page.locator('button.rate-star');
    await stars.nth(4).click();

    // Select at least one chip option (e.g. first chip)
    const chip = page.locator('button.rate-chip').first();
    await chip.waitFor({ state: 'visible', timeout: 5000 });
    await chip.click();

    // Click "Submit Feedback"
    await page.click('button.rate-submit-btn');

    // Verify rating success message
    await expect(page.locator('.rate-thanks')).toContainText('Thanks for rating!');

    // Click "Back to start" button to return to home page
    await page.click('button:has-text("Back to start")');
    await page.waitForURL('**/');
    await expect(page.locator('.tagline')).toBeVisible();
  });
});
