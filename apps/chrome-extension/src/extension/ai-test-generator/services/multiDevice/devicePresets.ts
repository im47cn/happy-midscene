/**
 * Device Presets Configuration
 * Common device configurations for quick setup
 */

import type { DeviceConfig, DeviceType } from '../../types/multiDevice';

/**
 * Device preset definition
 */
export interface DevicePreset {
  /** Preset ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Device type */
  type: DeviceType;
  /** Category */
  category: 'mobile' | 'tablet' | 'desktop' | 'custom';
  /** Configuration overrides */
  config: Partial<Omit<DeviceConfig, 'id' | 'alias' | 'type'>>;
  /** Viewport dimensions (for browser type) */
  viewport?: {
    width: number;
    height: number;
  };
  /** Device scale factor */
  deviceScaleFactor?: number;
  /** Is mobile device */
  isMobile?: boolean;
  /** Has touch support */
  hasTouch?: boolean;
  /** User agent string */
  userAgent?: string;
}

/**
 * Mobile device presets
 */
export const mobilePresets: DevicePreset[] = [
  {
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    description: 'Apple iPhone 15 Pro (2023)',
    type: 'browser',
    category: 'mobile',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    config: {},
  },
  {
    id: 'iphone-15',
    name: 'iPhone 15',
    description: 'Apple iPhone 15 (2023)',
    type: 'browser',
    category: 'mobile',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    config: {},
  },
  {
    id: 'iphone-se',
    name: 'iPhone SE',
    description: 'Apple iPhone SE (2022)',
    type: 'browser',
    category: 'mobile',
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    config: {},
  },
  {
    id: 'pixel-8',
    name: 'Pixel 8',
    description: 'Google Pixel 8 (2023)',
    type: 'browser',
    category: 'mobile',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    config: {},
  },
  {
    id: 'pixel-7',
    name: 'Pixel 7',
    description: 'Google Pixel 7 (2022)',
    type: 'browser',
    category: 'mobile',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    config: {},
  },
  {
    id: 'galaxy-s24',
    name: 'Galaxy S24',
    description: 'Samsung Galaxy S24 (2024)',
    type: 'browser',
    category: 'mobile',
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    config: {},
  },
  {
    id: 'galaxy-s23',
    name: 'Galaxy S23',
    description: 'Samsung Galaxy S23 (2023)',
    type: 'browser',
    category: 'mobile',
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    config: {},
  },
];

/**
 * Tablet device presets
 */
export const tabletPresets: DevicePreset[] = [
  {
    id: 'ipad-pro-12.9',
    name: 'iPad Pro 12.9"',
    description: 'Apple iPad Pro 12.9 inch',
    type: 'browser',
    category: 'tablet',
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    config: {},
  },
  {
    id: 'ipad-pro-11',
    name: 'iPad Pro 11"',
    description: 'Apple iPad Pro 11 inch',
    type: 'browser',
    category: 'tablet',
    viewport: { width: 834, height: 1194 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    config: {},
  },
  {
    id: 'ipad-mini',
    name: 'iPad Mini',
    description: 'Apple iPad Mini',
    type: 'browser',
    category: 'tablet',
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    config: {},
  },
  {
    id: 'galaxy-tab-s9',
    name: 'Galaxy Tab S9',
    description: 'Samsung Galaxy Tab S9',
    type: 'browser',
    category: 'tablet',
    viewport: { width: 800, height: 1280 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    config: {},
  },
];

/**
 * Desktop device presets
 */
export const desktopPresets: DevicePreset[] = [
  {
    id: 'desktop-1920',
    name: 'Desktop 1920×1080',
    description: 'Full HD desktop',
    type: 'browser',
    category: 'desktop',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    config: {},
  },
  {
    id: 'desktop-2560',
    name: 'Desktop 2560×1440',
    description: '2K QHD desktop',
    type: 'browser',
    category: 'desktop',
    viewport: { width: 2560, height: 1440 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    config: {},
  },
  {
    id: 'laptop-1366',
    name: 'Laptop 1366×768',
    description: 'Common laptop resolution',
    type: 'browser',
    category: 'desktop',
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    config: {},
  },
  {
    id: 'laptop-1440',
    name: 'Laptop 1440×900',
    description: 'MacBook Air resolution',
    type: 'browser',
    category: 'desktop',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    config: {},
  },
];

/**
 * All device presets
 */
export const allPresets: DevicePreset[] = [
  ...mobilePresets,
  ...tabletPresets,
  ...desktopPresets,
];

/**
 * Get preset by ID
 */
export function getPresetById(id: string): DevicePreset | undefined {
  return allPresets.find((p) => p.id === id);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(
  category: DevicePreset['category'],
): DevicePreset[] {
  return allPresets.filter((p) => p.category === category);
}

/**
 * Get presets by type
 */
export function getPresetsByType(type: DeviceType): DevicePreset[] {
  return allPresets.filter((p) => p.type === type);
}

/**
 * Create device config from preset
 */
export function createConfigFromPreset(
  preset: DevicePreset,
  alias: string,
): DeviceConfig {
  const config: DeviceConfig = {
    id: `${preset.id}_${Date.now()}`,
    alias,
    type: preset.type,
    ...preset.config,
  };

  if (preset.viewport) {
    config.viewport = preset.viewport;
  }

  if (preset.type === 'browser') {
    // Browser-specific config would be set via BrowserSessionConfig
    // These are stored in the preset for reference
  }

  return config;
}

/**
 * Common multi-device test scenarios
 */
export interface TestScenario {
  id: string;
  name: string;
  description: string;
  devices: Array<{
    presetId: string;
    alias: string;
  }>;
}

/**
 * Predefined test scenarios
 */
export const testScenarios: TestScenario[] = [
  {
    id: 'responsive-test',
    name: 'Responsive Design Test',
    description: 'Test across mobile, tablet, and desktop viewports',
    devices: [
      { presetId: 'iphone-15-pro', alias: 'Mobile' },
      { presetId: 'ipad-pro-11', alias: 'Tablet' },
      { presetId: 'desktop-1920', alias: 'Desktop' },
    ],
  },
  {
    id: 'cross-platform-mobile',
    name: 'Cross-Platform Mobile',
    description: 'Test on both iOS and Android devices',
    devices: [
      { presetId: 'iphone-15', alias: 'iOS' },
      { presetId: 'pixel-8', alias: 'Android' },
    ],
  },
  {
    id: 'multi-user-collaboration',
    name: 'Multi-User Collaboration',
    description: 'Simulate multiple users on different devices',
    devices: [
      { presetId: 'desktop-1920', alias: 'User A (Admin)' },
      { presetId: 'laptop-1366', alias: 'User B (Member)' },
      { presetId: 'iphone-15', alias: 'User C (Mobile)' },
    ],
  },
  {
    id: 'ecommerce-flow',
    name: 'E-commerce User Journey',
    description: 'Customer browsing on mobile, completing purchase on desktop',
    devices: [
      { presetId: 'iphone-15', alias: 'Browse (Mobile)' },
      { presetId: 'desktop-1920', alias: 'Checkout (Desktop)' },
    ],
  },
];

/**
 * Get scenario by ID
 */
export function getScenarioById(id: string): TestScenario | undefined {
  return testScenarios.find((s) => s.id === id);
}

/**
 * Create device configs from scenario
 */
export function createConfigsFromScenario(
  scenarioId: string,
): DeviceConfig[] | undefined {
  const scenario = getScenarioById(scenarioId);
  if (!scenario) return undefined;

  return scenario.devices.map((d) => {
    const preset = getPresetById(d.presetId);
    if (!preset) {
      throw new Error(`Preset not found: ${d.presetId}`);
    }
    return createConfigFromPreset(preset, d.alias);
  });
}
