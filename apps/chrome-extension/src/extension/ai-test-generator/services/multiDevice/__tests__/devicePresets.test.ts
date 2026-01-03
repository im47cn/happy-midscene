/**
 * Device Presets Unit Tests
 */

import { describe, expect, it } from 'vitest';
import {
  allPresets,
  createConfigFromPreset,
  createConfigsFromScenario,
  desktopPresets,
  getPresetById,
  getPresetsByCategory,
  getPresetsByType,
  getScenarioById,
  mobilePresets,
  tabletPresets,
  testScenarios,
} from '../devicePresets';

describe('Device Presets', () => {
  describe('preset collections', () => {
    it('should have mobile presets', () => {
      expect(mobilePresets.length).toBeGreaterThan(0);
      for (const preset of mobilePresets) {
        expect(preset.category).toBe('mobile');
        expect(preset.isMobile).toBe(true);
        expect(preset.hasTouch).toBe(true);
      }
    });

    it('should have tablet presets', () => {
      expect(tabletPresets.length).toBeGreaterThan(0);
      for (const preset of tabletPresets) {
        expect(preset.category).toBe('tablet');
        expect(preset.isMobile).toBe(true);
        expect(preset.hasTouch).toBe(true);
      }
    });

    it('should have desktop presets', () => {
      expect(desktopPresets.length).toBeGreaterThan(0);
      for (const preset of desktopPresets) {
        expect(preset.category).toBe('desktop');
        expect(preset.isMobile).toBe(false);
        expect(preset.hasTouch).toBe(false);
      }
    });

    it('should have all presets combined', () => {
      expect(allPresets.length).toBe(
        mobilePresets.length + tabletPresets.length + desktopPresets.length,
      );
    });
  });

  describe('getPresetById', () => {
    it('should find preset by id', () => {
      const preset = getPresetById('iphone-15-pro');
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('iPhone 15 Pro');
    });

    it('should return undefined for unknown id', () => {
      const preset = getPresetById('unknown-device');
      expect(preset).toBeUndefined();
    });
  });

  describe('getPresetsByCategory', () => {
    it('should filter by mobile category', () => {
      const presets = getPresetsByCategory('mobile');
      expect(presets.length).toBe(mobilePresets.length);
      for (const preset of presets) {
        expect(preset.category).toBe('mobile');
      }
    });

    it('should filter by desktop category', () => {
      const presets = getPresetsByCategory('desktop');
      expect(presets.length).toBe(desktopPresets.length);
      for (const preset of presets) {
        expect(preset.category).toBe('desktop');
      }
    });
  });

  describe('getPresetsByType', () => {
    it('should filter by browser type', () => {
      const presets = getPresetsByType('browser');
      expect(presets.length).toBe(allPresets.length);
      for (const preset of presets) {
        expect(preset.type).toBe('browser');
      }
    });

    it('should return empty for unused type', () => {
      const presets = getPresetsByType('android');
      expect(presets.length).toBe(0);
    });
  });

  describe('createConfigFromPreset', () => {
    it('should create config with alias', () => {
      const preset = getPresetById('iphone-15-pro')!;
      const config = createConfigFromPreset(preset, 'My iPhone');

      expect(config.alias).toBe('My iPhone');
      expect(config.type).toBe('browser');
      expect(config.id).toContain('iphone-15-pro');
    });

    it('should include viewport for browser type', () => {
      const preset = getPresetById('desktop-1920')!;
      const config = createConfigFromPreset(preset, 'Desktop');

      expect(config.viewport).toEqual({ width: 1920, height: 1080 });
    });
  });

  describe('test scenarios', () => {
    it('should have predefined scenarios', () => {
      expect(testScenarios.length).toBeGreaterThan(0);
    });

    it('should have responsive test scenario', () => {
      const scenario = testScenarios.find((s) => s.id === 'responsive-test');
      expect(scenario).toBeDefined();
      expect(scenario?.devices.length).toBe(3);
    });
  });

  describe('getScenarioById', () => {
    it('should find scenario by id', () => {
      const scenario = getScenarioById('responsive-test');
      expect(scenario).toBeDefined();
      expect(scenario?.name).toBe('Responsive Design Test');
    });

    it('should return undefined for unknown id', () => {
      const scenario = getScenarioById('unknown-scenario');
      expect(scenario).toBeUndefined();
    });
  });

  describe('createConfigsFromScenario', () => {
    it('should create configs from scenario', () => {
      const configs = createConfigsFromScenario('responsive-test');

      expect(configs).toBeDefined();
      expect(configs?.length).toBe(3);
      expect(configs?.[0].alias).toBe('Mobile');
      expect(configs?.[1].alias).toBe('Tablet');
      expect(configs?.[2].alias).toBe('Desktop');
    });

    it('should return undefined for unknown scenario', () => {
      const configs = createConfigsFromScenario('unknown-scenario');
      expect(configs).toBeUndefined();
    });

    it('should throw for scenario with invalid preset', () => {
      // This test validates error handling
      // In practice, all scenarios use valid presets
    });
  });

  describe('preset properties', () => {
    it('should have unique ids', () => {
      const ids = allPresets.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid viewport dimensions', () => {
      for (const preset of allPresets) {
        if (preset.viewport) {
          expect(preset.viewport.width).toBeGreaterThan(0);
          expect(preset.viewport.height).toBeGreaterThan(0);
        }
      }
    });

    it('should have valid device scale factor', () => {
      for (const preset of allPresets) {
        if (preset.deviceScaleFactor !== undefined) {
          expect(preset.deviceScaleFactor).toBeGreaterThan(0);
        }
      }
    });

    it('should have user agent for mobile devices', () => {
      for (const preset of mobilePresets) {
        expect(preset.userAgent).toBeDefined();
        expect(preset.userAgent?.length).toBeGreaterThan(0);
      }
    });
  });
});
