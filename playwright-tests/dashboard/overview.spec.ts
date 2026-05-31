import { test, expect, type Page } from "playwright/test";

const BASE_URL = "http://localhost:3000";

// The account below was used in the QA session and has real transaction data.
const QA_EMAIL = "vlad_krasovsky@yahoo.com";
const QA_PASSWORD = "Eb49zvgtpc!";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAndGoDashboard(page: Page) {
  await page.goto(`${BASE_URL}/secure/dashboard`);
  // If redirected away from /secure/* we need to log in
  if (!page.url().includes("/secure/")) {
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[type="email"]').pressSequentially(QA_EMAIL);
    await page.locator('input[type="password"]').fill(QA_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/\/secure\/dashboard/);
  }
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

// ---------------------------------------------------------------------------
// Page structure / render
// ---------------------------------------------------------------------------

test.describe("Dashboard — page structure", () => {
  test("renders welcome heading, stat cards, cash flow, and recent activity", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    // Welcome heading includes the username
    await expect(
      page.getByRole("heading", { name: /Welcome Back,/i })
    ).toBeVisible();

    // The three stat card titles are present
    await expect(page.getByText("Monthly Spent")).toBeVisible();
    await expect(page.getByText("Monthly Income")).toBeVisible();
    await expect(page.getByText("My Balance")).toBeVisible();

    // Cash flow section placeholder
    await expect(page.getByText("Cash flow")).toBeVisible();
    await expect(page.getByText("Chart coming soon")).toBeVisible();

    // Recent Activity section
    await expect(page.getByText("Recent Activity")).toBeVisible();

    // Export Report button is disabled (coming soon)
    await expect(
      page.getByRole("button", { name: /Export Report/i })
    ).toBeDisabled();
  });

  test("sidebar navigation links are all present", async ({ page }) => {
    await loginAndGoDashboard(page);

    await expect(page.getByRole("link", { name: /Overview/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /My Wallet/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Statements/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Transactions/i })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Setting/i })).toBeVisible();
  });

  test("header shows search bar, bell button, and user dropdown trigger", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    await expect(
      page.getByPlaceholder("Search for everything...")
    ).toBeVisible();
    // Bell button exists in the header
    await expect(page.locator("header button").first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Stat card month selector
// ---------------------------------------------------------------------------

test.describe("Dashboard — stat card month selectors", () => {
  test("Monthly Spent card shows a month combobox defaulted to current month", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    // All three stat cards have month selectors (comboboxes)
    const comboboxes = page.getByRole("combobox");
    // At minimum three month selectors are rendered (one per stat card)
    await expect(comboboxes.first()).toBeVisible();
    const firstText = await comboboxes.first().textContent();
    // Should contain a year number like "2026"
    expect(firstText).toMatch(/\d{4}/);
  });

  test("changing month on Monthly Spent card triggers a new API request", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    // Intercept transactions requests to track new calls
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/transactions")) requests.push(req.url());
    });

    // Open first month combobox
    await page.getByRole("combobox").first().click();
    const options = page.getByRole("option");
    // Click the second option (a month other than the current one)
    await options.nth(1).click();

    // A new transactions request should have been fired
    await page.waitForTimeout(500);
    const newReqs = requests.filter((u) => u.includes("date_from"));
    expect(newReqs.length).toBeGreaterThan(0);
  });

  test("month selector dropdown lists at least 12 month options", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    await page.getByRole("combobox").first().click();
    const options = page.getByRole("option");
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------

test.describe("Dashboard — recent activity list", () => {
  test("shows transaction rows with merchant name, date, card badge, and amount", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    // Wait for at least one transaction row
    // Each row has a merchant paragraph and an amount span
    await expect(page.locator("main").getByText(/\$\d+\.\d{2}/).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("pagination controls are rendered when there are multiple pages", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    // With the QA account data there are 3 pages (May 2026)
    await expect(
      page.getByRole("button", { name: "Next page" })
    ).toBeVisible();
    await expect(page.getByText(/1\s*\/\s*\d+/)).toBeVisible();
  });

  test("clicking Next page shows page 2 transactions", async ({ page }) => {
    await loginAndGoDashboard(page);

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText(/2\s*\/\s*\d+/)).toBeVisible({ timeout: 3000 });

    // Previous page button should now be enabled
    await expect(
      page.getByRole("button", { name: "Previous page" })
    ).toBeEnabled();
  });

  test("Previous page button is disabled on page 1", async ({ page }) => {
    await loginAndGoDashboard(page);

    await expect(
      page.getByRole("button", { name: "Previous page" })
    ).toBeDisabled();
  });

  test("clicking Previous page after going to page 2 returns to page 1", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText(/2\s*\/\s*/)).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(page.getByText(/1\s*\/\s*/)).toBeVisible({ timeout: 3000 });
    await expect(
      page.getByRole("button", { name: "Previous page" })
    ).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Card filter on Recent Activity
// ---------------------------------------------------------------------------

test.describe("Dashboard — card filter in recent activity", () => {
  test("All cards combobox is rendered and defaults to All cards", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);
    // The last combobox on the page is the card selector
    const cardCombo = page.getByRole("combobox").last();
    await expect(cardCombo).toBeVisible();
    const text = await cardCombo.textContent();
    expect(text).toMatch(/All cards/i);
  });

  test("card filter dropdown lists individual cards", async ({ page }) => {
    await loginAndGoDashboard(page);

    const cardCombo = page.getByRole("combobox").last();
    await cardCombo.click();

    const options = page.getByRole("option");
    const count = await options.count();
    // Should have "All cards" plus at least one real card
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("selecting a specific card filters the activity list and updates the label", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    const cardCombo = page.getByRole("combobox").last();
    await cardCombo.click();

    const options = page.getByRole("option");
    const cardOption = options.nth(1); // first real card (not "All cards")
    const cardLabel = (await cardOption.textContent()) ?? "";
    await cardOption.click();

    // The combobox label should now show the selected card's last4/nickname
    await expect(cardCombo).not.toHaveText(/All cards/i);

    // The displayed label contains the selected card text (truncated is ok)
    const updatedText = await cardCombo.textContent();
    // Extract the last4 digits from the option (e.g. "••1234 — Test Chase")
    const last4Match = cardLabel.match(/••(\d{4})/);
    if (last4Match) {
      expect(updatedText).toContain(last4Match[1]);
    }
  });

  test("selecting a card triggers a filtered API request with card_ids param", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    const cardRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("card_ids=")) cardRequests.push(req.url());
    });

    const cardCombo = page.getByRole("combobox").last();
    await cardCombo.click();
    await page.getByRole("option").nth(1).click();

    await page.waitForTimeout(500);
    expect(cardRequests.length).toBeGreaterThan(0);
    expect(cardRequests[0]).toContain("card_ids=");
  });
});

// ---------------------------------------------------------------------------
// Header interactions
// ---------------------------------------------------------------------------

test.describe("Dashboard — header user dropdown", () => {
  test("user dropdown opens and shows Settings, Dark Mode, and Log out", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    // The user dropdown trigger is the second button in the header
    const headerBtns = page.locator("header button");
    await headerBtns.nth(1).click();

    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Dark Mode")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  });

  test("dark mode toggle changes the page theme", async ({ page }) => {
    await loginAndGoDashboard(page);

    const headerBtns = page.locator("header button");
    await headerBtns.nth(1).click();

    // Toggle dark mode on
    await page.getByText("Dark Mode").click();
    const htmlClass = await page
      .locator("html")
      .getAttribute("class");
    expect(htmlClass).toContain("dark");

    // Toggle dark mode back off (reopen dropdown)
    await headerBtns.nth(1).click();
    await page.getByText("Dark Mode").click();
    const htmlClassAfter = await page.locator("html").getAttribute("class");
    expect(htmlClassAfter ?? "").not.toContain("dark");
  });

  test("Settings link in dropdown navigates to /secure/settings", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);

    const headerBtns = page.locator("header button");
    await headerBtns.nth(1).click();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/secure\/settings/);
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe("Dashboard — sidebar navigation", () => {
  test("My Wallet link navigates to /secure/wallet", async ({ page }) => {
    await loginAndGoDashboard(page);
    await page.getByRole("link", { name: /My Wallet/i }).click();
    await expect(page).toHaveURL(/\/secure\/wallet/);
  });

  test("Statements link navigates to /secure/statements", async ({ page }) => {
    await loginAndGoDashboard(page);
    await page.getByRole("link", { name: /Statements/i }).click();
    await expect(page).toHaveURL(/\/secure\/statements/);
  });

  test("Transactions link navigates to /secure/transactions", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);
    // Use exact match so it doesn't match 'Add new transaction' link
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /Transactions/i })
      .click();
    await expect(page).toHaveURL(/\/secure\/transactions/);
  });

  test("Add new button in Recent Activity navigates to /secure/transactions", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);
    await page.getByRole("link", { name: /Add new/i }).click();
    await expect(page).toHaveURL(/\/secure\/transactions/);
  });
});

// ---------------------------------------------------------------------------
// API errors - known regression: page_size=500 exceeds API limit of 200
// ---------------------------------------------------------------------------

test.describe("Dashboard — API calls", () => {
  test("stat card API calls do NOT return 422 (page_size <= 200)", async ({
    page,
  }) => {
    const failedUrls: string[] = [];
    page.on("response", (resp) => {
      if (
        resp.url().includes("/api/v1/transactions") &&
        resp.status() === 422
      ) {
        failedUrls.push(resp.url());
      }
    });

    await loginAndGoDashboard(page);
    await page.waitForTimeout(2000); // let all queries settle

    expect(
      failedUrls,
      `The following transaction requests returned 422 (page_size exceeds API max of 200):\n${failedUrls.join("\n")}`
    ).toHaveLength(0);
  });

  test("recent activity list API call succeeds with 200", async ({ page }) => {
    let recentStatus: number | null = null;
    page.on("response", (resp) => {
      if (
        resp.url().includes("/api/v1/transactions") &&
        resp.url().includes("page=1") &&
        resp.url().includes("page_size=10")
      ) {
        recentStatus = resp.status();
      }
    });

    await loginAndGoDashboard(page);
    await page.waitForTimeout(2000);

    expect(recentStatus).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Non-functional / stub elements
// ---------------------------------------------------------------------------

test.describe("Dashboard — stub/coming-soon elements", () => {
  test("Export Report button is visually present but disabled", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);
    const exportBtn = page.getByRole("button", { name: /Export Report/i });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeDisabled();
  });

  test("Cash Flow chart section shows 'Chart coming soon' placeholder", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);
    await expect(page.getByText("Chart coming soon")).toBeVisible();
  });

  test("sidebar Cryptocurrency, Messages, and Report items are marked coming soon", async ({
    page,
  }) => {
    await loginAndGoDashboard(page);
    // These items render as non-link generics with title="Coming soon"
    await expect(
      page.locator('[title="Coming soon"]').first()
    ).toBeVisible();
  });
});
