const { test, expect } = require('@playwright/test');

test('subscribe form shows success message', async ({ page }) => {
    await page.route('**/api/subscribe', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Confirmation email sent.' }),
        });
    });

    await page.goto('/');

    await page.fill('#email', 'user@example.com');
    await page.fill('#repo', 'nodejs/node');
    await page.click('#subscribe-btn');

    await expect(page.locator('#subscribe-alert')).toContainText('Confirmation email sent.');
    await expect(page.locator('#email')).toHaveValue('');
    await expect(page.locator('#repo')).toHaveValue('');
});

test('lookup and unsubscribe flow updates list', async ({ page }) => {
    let subscriptionsCall = 0;

    await page.route('**/api/subscriptions*', async (route) => {
        subscriptionsCall += 1;
        const payload = subscriptionsCall === 1
            ? [{
                email: 'user@example.com',
                repo: 'nodejs/node',
                confirmed: true,
                last_seen_tag: 'v1.0.0',
            }]
            : [];

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(payload),
        });
    });

    await page.route('**/api/unsubscribe/**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Unsubscribed successfully.' }),
        });
    });

    await page.goto('/');

    await page.click('.tab[data-panel="my-subs-panel"]');
    await page.fill('#lookup-email', 'user@example.com');
    await page.click('#lookup-btn');

    await expect(page.locator('.sub-item .repo')).toHaveText('nodejs/node');
    await expect(page.locator('.badge-confirmed')).toContainText('Confirmed');

    await page.click('.btn-unsubscribe');
    await expect(page.locator('#unsubscribe-modal')).toHaveClass(/open/);
    await page.fill('#unsubscribe-token-input', 'token-123');
    await page.click('#unsubscribe-confirm-btn');

    await expect(page.locator('#lookup-alert')).toContainText('Unsubscribed successfully.');
    await expect(page.locator('.sub-list')).toContainText('No subscriptions found');
});
