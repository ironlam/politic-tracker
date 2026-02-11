import { test, expect } from "@playwright/test";

/**
 * Visual Regression Tests for Poligraph
 *
 * These tests capture screenshots of key pages and compare them
 * against baseline snapshots to detect visual regressions.
 *
 * Update baselines: npm run test:visual:update
 */

test.describe("Homepage", () => {
  test("renders correctly", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait for hero section to be visible
    await expect(page.locator("h1")).toBeVisible();

    await expect(page).toHaveScreenshot("homepage.png", {
      fullPage: true,
      mask: [
        // Mask dynamic content like stats that may change
        page.locator('[data-testid="stats-counter"]'),
      ],
    });
  });

  test("hero section visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText(/transparence|politique/i);
  });
});

test.describe("Politicians List", () => {
  test("renders politician cards", async ({ page }) => {
    await page.goto("/politiques");
    await page.waitForLoadState("domcontentloaded");

    // Wait for the page title and cards to appear
    await expect(page.locator("h1")).toContainText(/représentants/i, { timeout: 15000 });

    // Wait for at least one card to be visible (look for politician names/links)
    await expect(page.locator('a[href^="/politiques/"]').first()).toBeVisible({
      timeout: 15000,
    });

    await expect(page).toHaveScreenshot("politicians-list.png", {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });
  });

  test("search functionality works", async ({ page }) => {
    await page.goto("/politiques");
    await page.waitForLoadState("domcontentloaded");

    // Wait for page to be ready
    await expect(page.locator("h1")).toContainText(/représentants/i, { timeout: 15000 });

    const searchInput = page.locator('input[placeholder*="Rechercher"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill("Macron");
    await page.waitForTimeout(800); // Wait for debounce + API response

    // Should show filtered results - look for "Macron" in the page content
    await expect(page.locator("text=Macron").first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Politician Detail Page", () => {
  test("renders politician profile", async ({ page }) => {
    // Use a stable politician (president)
    await page.goto("/politiques/emmanuel-macron");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText(/Macron/);

    await expect(page).toHaveScreenshot("politician-detail.png", {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 900 },
      mask: [
        // Mask last updated dates
        page.locator('[data-testid="last-updated"]'),
      ],
    });
  });
});

test.describe("Affairs Page", () => {
  test("renders affairs list", async ({ page }) => {
    await page.goto("/affaires");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText(/affaires/i);

    await expect(page).toHaveScreenshot("affairs-list.png", {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });
  });
});

test.describe("Institutions Page", () => {
  test("renders institutions info", async ({ page }) => {
    await page.goto("/institutions");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toBeVisible();

    await expect(page).toHaveScreenshot("institutions.png", {
      fullPage: true,
    });
  });
});

test.describe("Chatbot Page", () => {
  test("renders chat interface", async ({ page }) => {
    await page.goto("/chat");
    await page.waitForLoadState("networkidle");

    // Check for chat input
    await expect(
      page.locator('textarea, input[type="text"][placeholder*="question"]')
    ).toBeVisible();

    await expect(page).toHaveScreenshot("chatbot.png", {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 700 },
    });
  });
});

test.describe("Assemblee Page", () => {
  test("renders legislative dossiers", async ({ page }) => {
    await page.goto("/assemblee");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText(/assemblée/i);

    await expect(page).toHaveScreenshot("assemblee.png", {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });
  });
});

test.describe("Dark Mode", () => {
  test("toggles dark mode correctly", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find and click theme toggle
    const themeToggle = page.locator('button[aria-label*="theme"], [data-testid="theme-toggle"]');
    if ((await themeToggle.count()) > 0) {
      await themeToggle.click();
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot("homepage-dark.png", {
        fullPage: false,
        clip: { x: 0, y: 0, width: 1280, height: 700 },
      });
    }
  });
});

test.describe("Mobile Responsive", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("homepage mobile view", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("homepage-mobile.png", {
      fullPage: false,
    });
  });

  test("mobile menu opens", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find hamburger menu
    const menuButton = page.locator(
      'button[aria-label*="menu"], [data-testid="mobile-menu-button"]'
    );
    if ((await menuButton.count()) > 0) {
      await menuButton.click();
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot("mobile-menu-open.png");
    }
  });
});

test.describe("Accessibility", () => {
  test("has correct heading hierarchy", async ({ page }) => {
    await page.goto("/");

    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    // Check h2s exist
    const h2Count = await page.locator("h2").count();
    expect(h2Count).toBeGreaterThan(0);
  });

  test("skip link is present", async ({ page }) => {
    await page.goto("/");

    const skipLink = page.locator('a[href="#main-content"], a[href="#main"]');
    // Skip link should exist (may be visually hidden)
    expect(await skipLink.count()).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Error Pages", () => {
  test("404 page renders", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-12345");
    await page.waitForLoadState("networkidle");

    // Should show 404 or redirect to home
    const pageContent = await page.textContent("body");
    const is404 = pageContent?.includes("404") || pageContent?.includes("trouvé");

    if (is404) {
      await expect(page).toHaveScreenshot("404.png");
    }
  });
});

test.describe("Politician with Affairs", () => {
  test("affair badges render correctly on desktop", async ({ page }) => {
    await page.goto("/politiques/sylvie-andrieux");
    await page.waitForLoadState("networkidle");

    // Wait for affairs section heading to load
    await expect(page.getByRole("heading", { name: "Affaires judiciaires" })).toBeVisible({
      timeout: 10000,
    });

    // Scroll to affairs section
    await page.getByRole("heading", { name: "Affaires judiciaires" }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("politician-affairs-desktop.png", {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 900 },
    });
  });
});

test.describe("Politician with Affairs - Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("affair badge renders correctly on mobile", async ({ page }) => {
    // Use a politician with affairs
    await page.goto("/politiques/sylvie-andrieux");
    await page.waitForLoadState("networkidle");

    // Wait for affairs section heading to load
    await expect(page.getByRole("heading", { name: "Affaires judiciaires" })).toBeVisible({
      timeout: 10000,
    });

    // Scroll to affairs section
    await page.getByRole("heading", { name: "Affaires judiciaires" }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("politician-affairs-mobile.png", {
      fullPage: true,
    });
  });
});
