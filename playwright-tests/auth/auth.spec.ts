import { test, expect, type Page } from "playwright/test";

const BASE_URL = "http://localhost:3000";
// Timestamped email — unique per test run so parallel CI runs don't collide
const UNIQUE_SUFFIX = Date.now();
const SHARED_EMAIL = `qatest_${UNIQUE_SUFFIX}@example.com`;
const SHARED_PASSWORD = "TestPass123!";

/** Clear all browser-side auth state. Zustand is in-memory (resets per page),
 *  but clearing cookies ensures the httpOnly refresh-token cookie is gone. */
async function clearAuthState(page: Page) {
  await page.evaluate(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    try { sessionStorage.clear(); } catch { /* ignore */ }
  });
  await page.context().clearCookies();
}

/** Register a new account and return to the dashboard. */
async function signupAndWait(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/signup`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE_URL}/secure/dashboard`);
}

/** Log in and wait for dashboard. */
async function loginAndWait(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(`${BASE_URL}/secure/dashboard`);
}

// ---------------------------------------------------------------------------
// Ensure the shared account exists before all tests in the file run
// ---------------------------------------------------------------------------
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await signupAndWait(page, SHARED_EMAIL, SHARED_PASSWORD);
  } catch {
    // Account may already exist if a previous run did not clean up — that is fine
  }
  await ctx.close();
});

// ---------------------------------------------------------------------------
// Signup flow
// ---------------------------------------------------------------------------
test.describe("Auth — Signup flow", () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test("signup page renders correctly", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    // CardTitle is rendered as a <div>, not a heading element — use exact text locator
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
    // CardTitle text — narrow selector to avoid matching the submit button
    await expect(page.locator("div.text-2xl")).toContainText("Create account");
  });

  test("signup — validation: empty form shows field errors", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
    expect(page.url()).toContain("/signup");
  });

  test("signup — validation: mismatched passwords", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Password", { exact: true }).fill("Password123!");
    await page.getByLabel("Confirm Password").fill("Different123!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Passwords do not match")).toBeVisible();
    expect(page.url()).toContain("/signup");
  });

  test("signup — validation: password too short", async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByLabel("Confirm Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
  });

  test("signup — happy path: new user registers and lands on dashboard", async ({ page }) => {
    const email = `signup_happy_${UNIQUE_SUFFIX}@example.com`;
    await signupAndWait(page, email, SHARED_PASSWORD);
    await expect(page.getByRole("heading", { name: `Welcome, ${email}` })).toBeVisible();
  });

  test("signup — duplicate email shows error message", async ({ page }) => {
    const email = `dup_${UNIQUE_SUFFIX}@example.com`;

    // First registration
    await signupAndWait(page, email, SHARED_PASSWORD);
    // Log out via sidebar
    await page.getByRole("button", { name: "Logout" }).click();
    await page.waitForURL(`${BASE_URL}/`);
    await clearAuthState(page);

    // Second registration with same email
    await page.goto(`${BASE_URL}/signup`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(SHARED_PASSWORD);
    await page.getByLabel("Confirm Password").fill(SHARED_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("An account with this email already exists")).toBeVisible();
    expect(page.url()).toContain("/signup");
  });

  /**
   * F1 analogue for signup — server error clears when user starts typing.
   * The fix uses a useEffect that calls setFormError(null) whenever
   * any watched field changes.
   */
  test("signup — server error clears when user starts typing (F1 fix)", async ({ page }) => {
    const email = `f1s_${UNIQUE_SUFFIX}@example.com`;

    // Create account, then log out
    await signupAndWait(page, email, SHARED_PASSWORD);
    await page.getByRole("button", { name: "Logout" }).click();
    await page.waitForURL(`${BASE_URL}/`);
    await clearAuthState(page);

    // Re-trigger the duplicate-email server error
    await page.goto(`${BASE_URL}/signup`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(SHARED_PASSWORD);
    await page.getByLabel("Confirm Password").fill(SHARED_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("An account with this email already exists")).toBeVisible();

    // Typing in a field must clear the server error
    await page.getByLabel("Email").fill("new@example.com");
    await expect(page.getByText("An account with this email already exists")).not.toBeVisible();
  });

  test("signup — already logged-in user is redirected to dashboard", async ({ page }) => {
    const email = `alin_${UNIQUE_SUFFIX}@example.com`;

    // Register and end up on dashboard
    await signupAndWait(page, email, SHARED_PASSWORD);

    // Try to navigate to signup — beforeLoad guard should redirect away
    await page.goto(`${BASE_URL}/signup`);
    await expect(page).toHaveURL(`${BASE_URL}/secure/dashboard`);
  });
});

// ---------------------------------------------------------------------------
// Login flow
// ---------------------------------------------------------------------------
test.describe("Auth — Login flow", () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await page.goto(`${BASE_URL}/`);
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    // CardTitle is rendered as a <div>, not a heading element
    await expect(page.locator("div.text-2xl")).toContainText("Log in");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" }).first()).toBeVisible();
  });

  test("login — validation: empty form shows field errors", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
    expect(page.url()).toContain("/login");
  });

  test("login — invalid credentials show error message", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel("Email").fill("nonexistent@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    expect(page.url()).toContain("/login");
  });

  test("login — happy path: valid credentials redirect to dashboard", async ({ page }) => {
    await loginAndWait(page, SHARED_EMAIL, SHARED_PASSWORD);
    await expect(page.getByRole("heading", { name: `Welcome, ${SHARED_EMAIL}` })).toBeVisible();
  });

  test("login — redirect param is honoured after login", async ({ page }) => {
    // Navigate to protected route while unauthenticated
    await page.goto(`${BASE_URL}/secure/dashboard`);
    await expect(page).toHaveURL(/\/login\?redirect=/);

    // Log in — should land back on dashboard
    await page.getByLabel("Email").fill(SHARED_EMAIL);
    await page.getByLabel("Password").fill(SHARED_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await page.waitForURL(`${BASE_URL}/secure/dashboard`);
    await expect(page.getByRole("heading", { name: `Welcome, ${SHARED_EMAIL}` })).toBeVisible();
  });

  test("login — already logged-in user is redirected to dashboard", async ({ page }) => {
    await loginAndWait(page, SHARED_EMAIL, SHARED_PASSWORD);

    // Try to visit login page again — beforeLoad guard redirects away
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveURL(`${BASE_URL}/secure/dashboard`);
  });

  /**
   * F1 regression test — previously the stale server error "Invalid email or password"
   * would remain visible alongside Zod field errors after the user cleared both fields.
   *
   * Fixed in login.tsx by adding:
   *   const watchedFields = form.watch();
   *   useEffect(() => {
   *     if (formError) setFormError(null);
   *   }, [watchedFields.email, watchedFields.password]);
   */
  test("login — F1 fix: stale server error clears when user edits fields", async ({ page }) => {
    // Step 1: trigger server-side "Invalid email or password" error
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();

    // Step 2: clear both fields — the useEffect fires and clears formError
    await page.getByLabel("Email").fill("");
    await page.getByLabel("Password").fill("");

    // Step 3: stale server error must be gone; only Zod errors should remain
    await expect(page.getByText("Invalid email or password")).not.toBeVisible();

    // Step 4: submit empty form — only Zod field errors appear, no server error
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
    await expect(page.getByText("Invalid email or password")).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Protected route
// ---------------------------------------------------------------------------
test.describe("Auth — Protected route redirect", () => {
  test("unauthenticated access to /secure/dashboard redirects to /login", async ({ page }) => {
    // Each test starts with a fresh browser context — no auth state
    await page.goto(`${BASE_URL}/secure/dashboard`);
    await expect(page).toHaveURL(/\/login/);
    // Login form should be visible
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Logout flow
// ---------------------------------------------------------------------------
test.describe("Auth — Logout flow", () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await loginAndWait(page, SHARED_EMAIL, SHARED_PASSWORD);
  });

  test("logout via header dropdown redirects to home with toast", async ({ page }) => {
    // The header has a user info button that opens a dropdown
    // It is the last button inside the <header>/<banner> landmark
    const headerUserBtn = page.locator("header button, [role='banner'] button").last();
    await headerUserBtn.click();
    await page.getByRole("button", { name: "Log out" }).click();

    await page.waitForURL(`${BASE_URL}/`);
    await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" }).first()).toBeVisible();
    // Sonner toast confirms the logout
    await expect(page.getByText("Logged out")).toBeVisible();
  });

  test("logout via sidebar Logout button redirects to home", async ({ page }) => {
    await page.getByRole("button", { name: "Logout" }).click();

    await page.waitForURL(`${BASE_URL}/`);
    await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" }).first()).toBeVisible();
  });

  test("after logout, protected routes redirect to login", async ({ page }) => {
    await page.getByRole("button", { name: "Logout" }).click();
    await page.waitForURL(`${BASE_URL}/`);

    await page.goto(`${BASE_URL}/secure/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });
});
