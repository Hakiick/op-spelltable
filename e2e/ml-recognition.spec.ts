import { test, expect, type Page } from "@playwright/test";

/**
 * ML Recognition E2E Test
 *
 * This test verifies the card recognition pipeline end-to-end by:
 * 1. Opening /game/solo
 * 2. Selecting the IrunWebcam virtual camera
 * 3. Starting the recognition pipeline
 * 4. Waiting for card identifications
 * 5. Taking screenshots and logging results
 *
 * Prerequisites:
 * - IrunWebcam (or another virtual camera) must be running
 * - The dev server must be running on localhost:3000
 *
 * Run with: npx playwright test e2e/ml-recognition.spec.ts
 */

// Longer timeout for ML model loading
test.setTimeout(120_000);

async function selectCamera(page: Page, cameraName: string): Promise<boolean> {
  // Open camera settings dialog
  const settingsBtn = page.getByLabel("Open camera settings");
  if (!(await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log("[Test] Camera settings button not found");
    return false;
  }
  await settingsBtn.click();

  // Wait for dialog to open
  const dialog = page.locator("[role='dialog']");
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Find the camera dropdown
  const select = page.locator("#camera-device-select");
  await expect(select).toBeVisible({ timeout: 5000 });

  // Get all options to find the matching camera
  const options = await select.locator("option").allTextContents();
  console.log("[Test] Available cameras:", options);

  const targetOption = options.find((opt) =>
    opt.toLowerCase().includes(cameraName.toLowerCase())
  );

  if (!targetOption) {
    console.log(`[Test] Camera "${cameraName}" not found in options`);
    // Close dialog
    await page.keyboard.press("Escape");
    return false;
  }

  // Select the camera by label text
  await select.selectOption({ label: targetOption });
  console.log(`[Test] Selected camera: ${targetOption}`);

  // Apply settings
  const applyBtn = page.getByRole("button", { name: /Apply Settings/i });
  await applyBtn.click();

  // Wait for dialog to close
  await expect(dialog).not.toBeVisible({ timeout: 10000 });
  console.log("[Test] Camera settings applied");
  return true;
}

async function waitForRecognitionResults(
  page: Page,
  timeoutMs: number = 30000
): Promise<string[]> {
  const logs: string[] = [];

  // Collect console logs for recognition results
  page.on("console", (msg) => {
    const text = msg.text();
    if (
      text.includes("[Match]") ||
      text.includes("[Score]") ||
      text.includes("[Identify]") ||
      text.includes("[Recognize]") ||
      text.includes("[Search]") ||
      text.includes("[OCR]") ||
      text.includes("[WorkerBridge]")
    ) {
      logs.push(text);
    }
    // Also capture warnings/errors for debugging
    if (msg.type() === "warning" || msg.type() === "error") {
      logs.push(`[${msg.type()}] ${text}`);
    }
  });

  // Wait until we see at least one [Match] log or timeout
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (logs.some((l) => l.includes("[Match]"))) break;
    await page.waitForTimeout(1000);
  }

  // Collect a few more frames for temporal smoothing
  await page.waitForTimeout(5000);

  return logs;
}

test.describe("ML Card Recognition", () => {
  test("recognizes cards via IrunWebcam", async ({ page, context }) => {
    // Grant camera and microphone permissions
    await context.grantPermissions(["camera", "microphone"]);

    // Navigate to solo game page
    await page.goto("/game/solo");
    console.log("[Test] Page loaded");

    // Wait for camera to auto-start or error out
    const cameraActiveLocator = page.locator("text=Camera active");
    const startCameraBtn = page.getByRole("button", { name: /start camera/i });

    // Camera auto-starts on mount, but may fail — retry if needed
    for (let attempt = 0; attempt < 3; attempt++) {
      const isActive = await cameraActiveLocator
        .isVisible({ timeout: 8000 })
        .catch(() => false);
      if (isActive) {
        console.log("[Test] Camera active (attempt %d)", attempt + 1);
        break;
      }
      console.log(
        "[Test] Camera not active (attempt %d), retrying...",
        attempt + 1
      );
      // Click "Start Camera" if visible
      if (
        await startCameraBtn.isVisible({ timeout: 2000 }).catch(() => false)
      ) {
        await startCameraBtn.click();
      }
      await page.waitForTimeout(3000);
    }

    await expect(cameraActiveLocator).toBeVisible({ timeout: 10000 });
    console.log("[Test] Camera confirmed active");

    // Wait a moment for device enumeration
    await page.waitForTimeout(2000);

    // Select IrunWebcam
    const cameraSelected = await selectCamera(page, "iriun");
    if (!cameraSelected) {
      console.log(
        "[Test] IrunWebcam not found — using default camera. Available cameras were listed above."
      );
    }

    // Wait for the new camera stream to stabilize
    await page.waitForTimeout(2000);
    await expect(cameraActiveLocator).toBeVisible({ timeout: 10000 });

    // Take screenshot of camera feed before recognition
    await page.screenshot({
      path: "pictures/test-before-recognition.png",
      fullPage: false,
    });
    console.log("[Test] Screenshot: test-before-recognition.png");

    // Start recognition
    const startBtn = page.getByLabel(/start card recognition/i);
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    await startBtn.click();
    console.log("[Test] Recognition started — waiting for ML model to load...");

    // Wait for model to finish loading (loading indicator disappears)
    await expect(page.locator("text=Loading ML model").first()).not.toBeVisible(
      { timeout: 60000 }
    );
    console.log("[Test] ML model loaded");

    // Collect recognition results
    const logs = await waitForRecognitionResults(page, 30000);

    // Take screenshot with recognition results
    await page.screenshot({
      path: "pictures/test-recognition-results.png",
      fullPage: false,
    });
    console.log("[Test] Screenshot: test-recognition-results.png");

    // Parse and report results
    console.log("\n=== RECOGNITION RESULTS ===");
    const matchLogs = logs.filter((l) => l.includes("[Match]"));
    const scoreLogs = logs.filter((l) => l.includes("[Score]"));
    const identifyLogs = logs.filter((l) => l.includes("[Identify]"));

    if (matchLogs.length > 0) {
      // Deduplicate — show unique card matches
      const uniqueMatches = [...new Set(matchLogs)];
      console.log(`Found ${uniqueMatches.length} unique match entries:`);
      for (const m of uniqueMatches.slice(0, 20)) {
        console.log("  ", m);
      }
    } else {
      console.log("No card matches found");
    }

    const ocrLogs = logs.filter((l) => l.includes("[OCR]"));
    if (ocrLogs.length > 0) {
      console.log("\nOCR results:");
      for (const l of [...new Set(ocrLogs)].slice(0, 10)) {
        console.log("  ", l);
      }
    }

    if (identifyLogs.length > 0) {
      console.log("\nAmbiguous matches (gap filter):");
      for (const l of identifyLogs.slice(0, 10)) {
        console.log("  ", l);
      }
    }

    if (scoreLogs.length > 0) {
      console.log("\nTop scores (last frame):");
      // Show last 5 score logs
      for (const s of scoreLogs.slice(-5)) {
        console.log("  ", s);
      }
    }
    console.log("=== END RESULTS ===\n");

    // Wait a bit more and take a final screenshot for visual verification
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "pictures/test-recognition-final.png",
      fullPage: false,
    });
    console.log("[Test] Final screenshot: test-recognition-final.png");

    // Basic assertion: recognition pipeline should have produced some output
    const allLogs = logs.join("\n");
    const hasDetections =
      allLogs.includes("[Recognize]") || allLogs.includes("[Match]");
    expect(hasDetections).toBe(true);
  });
});
