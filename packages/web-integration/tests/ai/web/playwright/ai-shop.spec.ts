import { test } from './fixture';

test.beforeEach(async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.setViewportSize({ width: 1920, height: 1080 });
});

const CACHE_TIME_OUT = process.env.MIDSCENE_CACHE;

test('ai shop', async ({
  ai,
  aiInput,
  aiAssert,
  aiQuery,
  aiTap,
  agentForPage,
  page,
}) => {
  if (CACHE_TIME_OUT) {
    test.setTimeout(1000 * 1000);
  }
  // login
  const agent = await agentForPage(page);
  await aiInput('standard_user', 'in user name input');
  await aiInput('secret_sauce', 'in password input');
  await agent.aiTap('Login Button');

  // check the login success - verify we're on the inventory page
  await aiAssert('the page shows a product inventory with items for sale');

  // add to cart - use actual product name from saucedemo.com
  await aiTap('"Add to cart" button for "Sauce Labs Backpack"');

  await aiTap('click right top cart icon', {
    deepThink: true,
  });
});
