import { test, expect } from "playwright/test";

// Unique email shared across the signup/login/duplicate/logout flow
const TEST_EMAIL = `testuser_qa_${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPass123!";

test.describe("Authentication", () => {
  // -----------------------------------------------------------------------
  // 1. Unauthenticated redirect
  // -----------------------------------------------------------------------
  test("redirects unauthenticated user from /secure/dashboard to /login", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/secure/dashboard");
    await expect(page).toHaveURL(/\/login/);
    // Preserve the original destination in the redirect query param
    await expect(page).toHaveURL(/redirect=/);
  });

  // -----------------------------------------------------------------------
  // 2. Login form — empty submit shows validation errors
  // -----------------------------------------------------------------------
  test("login form shows validation errors on empty submit", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(
      page.getByText("Please enter a valid email address"),
    ).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 3. Login form — invalid email format shows error
  // -----------------------------------------------------------------------
  test("login form shows error for invalid email format", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.locator('input[type="email"]').fill("notanemail");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(
      page.getByText("Please enter a valid email address"),
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 4. Login — wrong credentials show "Invalid email or password"
  // -----------------------------------------------------------------------
  test("login with wrong credentials shows invalid credentials error", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/login");
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('input[type="password"]').fill("wrongpassword");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(
      page.getByText("Invalid email or password"),
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 5. Signup happy path — registers and redirects to /secure/dashboard
  // -----------------------------------------------------------------------
  test("signup happy path registers user and redirects to dashboard", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/signup");
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[name="password"]').fill(TEST_PASSWORD);
    await page.locator('input[name="confirmPassword"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/secure\/dashboard/);
    // Dashboard shows a welcome heading
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // 6. Logout — returns user to home page and clears session
  // -----------------------------------------------------------------------
  test("logout returns user to home page", async ({ page }) => {
    // Sign up a fresh account so we are authenticated
    const logoutTestEmail = `logout_qa_${Date.now()}@example.com`;
    await page.goto("http://localhost:3000/signup");
    await page.locator('input[type="email"]').fill(logoutTestEmail);
    await page.locator('input[name="password"]').fill(TEST_PASSWORD);
    await page.locator('input[name="confirmPassword"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/secure\/dashboard/);

    // Click the sidebar Logout button
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");

    // Confirm session is cleared: navigating to dashboard redirects to login
    await page.goto("http://localhost:3000/secure/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  // -----------------------------------------------------------------------
  // 7. Login happy path — logs in with existing credentials
  // -----------------------------------------------------------------------
  test("login happy path authenticates and redirects to dashboard", async ({
    page,
  }) => {
    // First create the account used for this test
    const loginTestEmail = `login_qa_${Date.now()}@example.com`;
    await page.goto("http://localhost:3000/signup");
    await page.locator('input[type="email"]').fill(loginTestEmail);
    await page.locator('input[name="password"]').fill(TEST_PASSWORD);
    await page.locator('input[name="confirmPassword"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/secure\/dashboard/);

    // Logout
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");

    // Log back in
    await page.goto("http://localhost:3000/login");
    await page.locator('input[type="email"]').fill(loginTestEmail);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/secure\/dashboard/);
  });

  // -----------------------------------------------------------------------
  // 8. Duplicate signup — shows "An account with this email already exists"
  // -----------------------------------------------------------------------
  test("duplicate signup shows account already exists error", async ({
    page,
  }) => {
    // Create account first
    const dupeEmail = `dupe_qa_${Date.now()}@example.com`;
    await page.goto("http://localhost:3000/signup");
    await page.locator('input[type="email"]').fill(dupeEmail);
    await page.locator('input[name="password"]').fill(TEST_PASSWORD);
    await page.locator('input[name="confirmPassword"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/secure\/dashboard/);

    // Logout
    await page.getByRole("button", { name: "Logout" }).click();

    // Try registering again with same email
    await page.goto("http://localhost:3000/signup");
    await page.locator('input[type="email"]').fill(dupeEmail);
    await page.locator('input[name="password"]').fill(TEST_PASSWORD);
    await page.locator('input[name="confirmPassword"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText("An account with this email already exists"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });

  // -----------------------------------------------------------------------
  // 9. Password mismatch — shows "Passwords do not match" validation error
  //    and does NOT submit the form
  // -----------------------------------------------------------------------
  test("signup shows passwords do not match validation error", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/signup");
    await page.locator('input[type="email"]').fill("mismatch@example.com");
    await page.locator('input[name="password"]').fill("TestPass123!");
    await page.locator('input[name="confirmPassword"]').fill("DifferentPass456!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    // Must remain on signup — no redirect
    await expect(page).toHaveURL(/\/signup/);
  });

  // -----------------------------------------------------------------------
  // 10. Signup route — authenticated user is redirected away from signup
  // -----------------------------------------------------------------------
  test("authenticated user visiting /signup is redirected to dashboard", async ({
    page,
  }) => {
    // Register a fresh user to get authenticated
    const authEmail = `authcheck_qa_${Date.now()}@example.com`;
    await page.goto("http://localhost:3000/signup");
    await page.locator('input[type="email"]').fill(authEmail);
    await page.locator('input[name="password"]').fill(TEST_PASSWORD);
    await page.locator('input[name="confirmPassword"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/secure\/dashboard/);

    // Try to navigate to /signup while logged in
    await page.goto("http://localhost:3000/signup");
    await expect(page).toHaveURL(/\/secure\/dashboard/);
  });
});
