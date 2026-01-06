/**
 * ScriptParser Unit Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { type ScriptParser, createScriptParser } from '../scriptParser';

describe('ScriptParser', () => {
  let parser: ScriptParser;

  beforeEach(() => {
    parser = createScriptParser();
  });

  describe('parse', () => {
    it('should parse a minimal valid script', () => {
      const yaml = `
name: "Test Script"
devices:
  web:
    type: browser
flow:
  - device: web
    steps:
      - ai: "Click button"
`;

      const result = parser.parse(yaml);

      expect(result.success).toBe(true);
      expect(result.script?.name).toBe('Test Script');
      expect(Object.keys(result.script?.devices || {})).toHaveLength(1);
      expect(result.script?.flow).toHaveLength(1);
    });

    it('should parse a full script with all features', () => {
      const yaml = `
name: "Full Test Script"
description: "A comprehensive test"
devices:
  customer_web:
    type: browser
    viewport: { width: 1920, height: 1080 }
    startUrl: "https://example.com"
  customer_mobile:
    type: android
    device: "emulator-5554"
    package: "com.example.app"
variables:
  testUser: "test@example.com"
  testPassword: "secret123"
flow:
  - name: "Web Login"
    device: customer_web
    steps:
      - ai: "Click login button"
      - ai: 'Enter email \${testUser}'
      - assert: "Login success"
      - export:
          orderId: "Get order ID"
  - sync: "after_login"
    timeout: 30000
  - name: "Mobile Check"
    device: customer_mobile
    steps:
      - ai: "Open orders"
`;

      const result = parser.parse(yaml);

      expect(result.success).toBe(true);
      expect(result.script?.description).toBe('A comprehensive test');
      expect(result.script?.devices.customer_web.type).toBe('browser');
      expect(result.script?.devices.customer_mobile.type).toBe('android');
      expect(result.script?.variables?.testUser).toBe('test@example.com');
      expect(result.script?.flow).toHaveLength(3);
    });

    it('should parse sync steps', () => {
      const yaml = `
name: "Sync Test"
devices:
  web:
    type: browser
flow:
  - sync: "checkpoint1"
    timeout: 5000
`;

      const result = parser.parse(yaml);

      expect(result.success).toBe(true);
      const syncStep = result.script?.flow[0];
      expect(syncStep?.type).toBe('sync');
      if (syncStep?.type === 'sync') {
        expect(syncStep.id).toBe('checkpoint1');
        expect(syncStep.timeout).toBe(5000);
      }
    });

    it('should parse parallel blocks', () => {
      const yaml = `
name: "Parallel Test"
devices:
  web1:
    type: browser
  web2:
    type: browser
flow:
  - blocks:
      - device: web1
        steps:
          - ai: "Action on web1"
      - device: web2
        steps:
          - ai: "Action on web2"
`;

      const result = parser.parse(yaml);

      expect(result.success).toBe(true);
      const parallelStep = result.script?.flow[0];
      expect(parallelStep?.type).toBe('parallel');
      if (parallelStep?.type === 'parallel') {
        expect(parallelStep.blocks).toHaveLength(2);
      }
    });

    it('should fail on missing name', () => {
      const yaml = `
devices:
  web:
    type: browser
flow:
  - device: web
    steps:
      - ai: "Click"
`;

      const result = parser.parse(yaml);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ message: 'Missing required field: name' }),
      );
    });

    it('should fail on missing devices', () => {
      const yaml = `
name: "Test"
flow:
  - device: web
    steps:
      - ai: "Click"
`;

      const result = parser.parse(yaml);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: 'Missing required field: devices',
        }),
      );
    });

    it('should fail on missing flow', () => {
      const yaml = `
name: "Test"
devices:
  web:
    type: browser
`;

      const result = parser.parse(yaml);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ message: 'Missing required field: flow' }),
      );
    });

    it('should fail on invalid device type', () => {
      const yaml = `
name: "Test"
devices:
  web:
    type: invalid_type
flow:
  - device: web
    steps:
      - ai: "Click"
`;

      const result = parser.parse(yaml);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('invalid type');
    });

    it('should fail on unknown device reference', () => {
      const yaml = `
name: "Test"
devices:
  web:
    type: browser
flow:
  - device: unknown_device
    steps:
      - ai: "Click"
`;

      const result = parser.parse(yaml);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('unknown device');
    });

    it('should handle invalid YAML', () => {
      const yaml = `
name: "Test
  invalid: yaml:
`;

      const result = parser.parse(yaml);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('YAML parse error');
    });
  });

  describe('validate', () => {
    it('should validate undefined variables', () => {
      const yaml = `
name: "Test"
devices:
  web:
    type: browser
flow:
  - device: web
    steps:
      - ai: 'Enter \${undefinedVar}'
`;

      const result = parser.parse(yaml);
      expect(result.success).toBe(true);

      const errors = parser.validate(result.script!);
      expect(errors).toContainEqual(expect.stringContaining('undefinedVar'));
    });

    it('should not warn for exported variables', () => {
      const yaml = `
name: "Test"
devices:
  web:
    type: browser
flow:
  - device: web
    steps:
      - ai: "Get order"
        export:
          orderId: "Get order ID"
  - device: web
    steps:
      - ai: 'Check order \${orderId}'
`;

      const result = parser.parse(yaml);
      expect(result.success).toBe(true);

      const errors = parser.validate(result.script!);
      expect(errors).toHaveLength(0);
    });

    it('should accept defined variables', () => {
      const yaml = `
name: "Test"
devices:
  web:
    type: browser
variables:
  testVar: "value"
flow:
  - device: web
    steps:
      - ai: 'Use \${testVar}'
`;

      const result = parser.parse(yaml);
      expect(result.success).toBe(true);

      const errors = parser.validate(result.script!);
      expect(errors).toHaveLength(0);
    });
  });

  describe('stringify', () => {
    it('should convert script back to YAML', () => {
      const yaml = `
name: "Test Script"
devices:
  web:
    type: browser
flow:
  - device: web
    steps:
      - ai: "Click button"
`;

      const parseResult = parser.parse(yaml);
      expect(parseResult.success).toBe(true);

      const output = parser.stringify(parseResult.script!);

      // Parse the output again to verify
      const reparsed = parser.parse(output);
      expect(reparsed.success).toBe(true);
      expect(reparsed.script?.name).toBe('Test Script');
    });

    it('should preserve all script properties', () => {
      const yaml = `
name: "Full Script"
description: "Test description"
devices:
  web:
    type: browser
    viewport:
      width: 1920
      height: 1080
variables:
  key: value
flow:
  - device: web
    name: "Step 1"
    steps:
      - ai: "Action"
      - assert: "Check"
  - sync: checkpoint
    timeout: 5000
`;

      const parseResult = parser.parse(yaml);
      expect(parseResult.success).toBe(true);

      const output = parser.stringify(parseResult.script!);
      const reparsed = parser.parse(output);

      expect(reparsed.script?.description).toBe('Test description');
      expect(reparsed.script?.variables?.key).toBe('value');
      expect(reparsed.script?.flow).toHaveLength(2);
    });
  });
});
