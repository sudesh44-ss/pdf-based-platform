import { test, expect } from '@playwright/test';

test.describe('Platform Smoke & Navigation Tests', () => {
  test('Landing page renders properly with hero and navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SmartPDF/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse Public Library/i })).toBeVisible();
  });

  test('Public Library lists documents with search and categories', async ({ page }) => {
    await page.goto('/library');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Public Technical Library');
    await expect(page.getByPlaceholder('Filter by title, tags, author...')).toBeVisible();
  });

  test('Reader route opens and displays controls', async ({ page }) => {
    await page.goto('/reader/doc-dist-sys-01');
    await expect(page.getByRole('toolbar', { name: /PDF Reader Toolbar/i })).toBeVisible();
  });

  test('Personal Dashboard displays statistics and navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Personal Study Dashboard');
  });

  test('Telegram Storage page displays infrastructure guidelines', async ({ page }) => {
    await page.goto('/storage');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Telegram Storage & Backup');
    await expect(page.getByText('Telegram Cloud Adapter Active')).toBeVisible();
  });
});
