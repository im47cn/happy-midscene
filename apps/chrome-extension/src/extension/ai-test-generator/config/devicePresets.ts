/**
 * Device Presets for H5 Mobile Mode
 * Based on Chrome DevTools device emulation presets
 */

export interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  userAgent: string;
  isMobile: boolean;
  hasTouch: boolean;
  category: 'mobile' | 'tablet' | 'desktop';
}

// Common mobile device presets
export const devicePresets: DevicePreset[] = [
  // Desktop (default)
  {
    id: 'desktop',
    name: 'Desktop',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    userAgent: '',
    isMobile: false,
    hasTouch: false,
    category: 'desktop',
  },
  // iPhone series
  {
    id: 'iphone-14-pro',
    name: 'iPhone 14 Pro',
    width: 393,
    height: 852,
    deviceScaleFactor: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    category: 'mobile',
  },
  {
    id: 'iphone-14',
    name: 'iPhone 14',
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    category: 'mobile',
  },
  {
    id: 'iphone-se',
    name: 'iPhone SE',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    category: 'mobile',
  },
  // Android devices
  {
    id: 'pixel-7',
    name: 'Pixel 7',
    width: 412,
    height: 915,
    deviceScaleFactor: 2.625,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true,
    category: 'mobile',
  },
  {
    id: 'samsung-s23',
    name: 'Samsung Galaxy S23',
    width: 360,
    height: 780,
    deviceScaleFactor: 3,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true,
    category: 'mobile',
  },
  {
    id: 'xiaomi-13',
    name: 'Xiaomi 13',
    width: 393,
    height: 851,
    deviceScaleFactor: 2.75,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; 2211133C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true,
    category: 'mobile',
  },
  // Tablets
  {
    id: 'ipad-pro-12',
    name: 'iPad Pro 12.9"',
    width: 1024,
    height: 1366,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    category: 'tablet',
  },
  {
    id: 'ipad-air',
    name: 'iPad Air',
    width: 820,
    height: 1180,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    category: 'tablet',
  },
  {
    id: 'galaxy-tab-s8',
    name: 'Galaxy Tab S8',
    width: 800,
    height: 1280,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (Linux; Android 12; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    isMobile: true,
    hasTouch: true,
    category: 'tablet',
  },
];

// Group presets by category
export const devicePresetsByCategory = {
  desktop: devicePresets.filter((d) => d.category === 'desktop'),
  mobile: devicePresets.filter((d) => d.category === 'mobile'),
  tablet: devicePresets.filter((d) => d.category === 'tablet'),
};

// Get preset by ID
export function getDevicePreset(id: string): DevicePreset | undefined {
  return devicePresets.find((d) => d.id === id);
}

// Default device
export const defaultDevice = devicePresets[0]; // Desktop
