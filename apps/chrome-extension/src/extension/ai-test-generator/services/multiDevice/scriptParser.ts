/**
 * Script Parser
 * Parses YAML collaborative scripts into executable format
 */

import * as yaml from 'js-yaml';
import type {
  ActionStep,
  CollaborativeScript,
  DeviceConfig,
  DeviceFlowStep,
  FlowStep,
  ParallelFlowStep,
  SyncFlowStep,
} from '../../types/multiDevice';

/**
 * Parse error with location info
 */
export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}

/**
 * Parse result
 */
export interface ParseResult {
  success: boolean;
  script?: CollaborativeScript;
  errors: ParseError[];
  warnings: string[];
}

/**
 * Raw YAML structure
 */
interface RawScript {
  name?: string;
  description?: string;
  devices?: Record<string, RawDevice>;
  variables?: Record<string, string>;
  flow?: RawFlowStep[];
}

interface RawDevice {
  type?: string;
  viewport?: { width: number; height: number };
  startUrl?: string;
  device?: string;
  package?: string;
  wdaHost?: string;
  wdaPort?: number;
  wsUrl?: string;
}

interface RawFlowStep {
  name?: string;
  device?: string;
  parallel?: boolean;
  steps?: RawActionStep[];
  sync?: string;
  timeout?: number;
  blocks?: RawFlowStep[];
}

interface RawActionStep {
  ai?: string;
  assert?: string;
  export?: Record<string, string>;
  waitFor?: string;
  navigate?: string;
}

/**
 * Script Parser
 */
export class ScriptParser {
  /**
   * Parse YAML string into CollaborativeScript
   */
  parse(yamlContent: string): ParseResult {
    const errors: ParseError[] = [];
    const warnings: string[] = [];

    try {
      const raw = yaml.load(yamlContent) as RawScript;

      if (!raw || typeof raw !== 'object') {
        return {
          success: false,
          errors: [{ message: 'Invalid YAML: expected object at root' }],
          warnings: [],
        };
      }

      // Validate required fields
      if (!raw.name) {
        errors.push({ message: 'Missing required field: name' });
      }

      if (!raw.devices || Object.keys(raw.devices).length === 0) {
        errors.push({ message: 'Missing required field: devices' });
      }

      if (!raw.flow || raw.flow.length === 0) {
        errors.push({ message: 'Missing required field: flow' });
      }

      if (errors.length > 0) {
        return { success: false, errors, warnings };
      }

      // Parse devices
      const devices: Record<string, Omit<DeviceConfig, 'id' | 'alias'>> = {};
      for (const [alias, rawDevice] of Object.entries(raw.devices!)) {
        const deviceResult = this.parseDevice(alias, rawDevice);
        if (deviceResult.error) {
          errors.push({ message: deviceResult.error });
        } else {
          devices[alias] = deviceResult.config!;
        }
      }

      // Parse flow
      const flow: FlowStep[] = [];
      const deviceAliases = Object.keys(devices);

      for (let i = 0; i < raw.flow!.length; i++) {
        const rawStep = raw.flow![i];
        const stepResult = this.parseFlowStep(rawStep, deviceAliases, i);

        if (stepResult.errors.length > 0) {
          errors.push(...stepResult.errors);
        }
        if (stepResult.warnings.length > 0) {
          warnings.push(...stepResult.warnings);
        }
        if (stepResult.step) {
          flow.push(stepResult.step);
        }
      }

      if (errors.length > 0) {
        return { success: false, errors, warnings };
      }

      const script: CollaborativeScript = {
        name: raw.name!,
        description: raw.description,
        devices,
        variables: raw.variables,
        flow,
      };

      return { success: true, script, errors: [], warnings };
    } catch (error) {
      const message =
        error instanceof yaml.YAMLException
          ? `YAML parse error: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);

      return {
        success: false,
        errors: [{ message }],
        warnings: [],
      };
    }
  }

  /**
   * Parse device configuration
   */
  private parseDevice(
    alias: string,
    raw: RawDevice,
  ): { config?: Omit<DeviceConfig, 'id' | 'alias'>; error?: string } {
    if (!raw.type) {
      return { error: `Device ${alias}: missing type` };
    }

    const validTypes = ['browser', 'android', 'ios', 'remote'];
    if (!validTypes.includes(raw.type)) {
      return {
        error: `Device ${alias}: invalid type "${raw.type}". Expected: ${validTypes.join(', ')}`,
      };
    }

    const config: Omit<DeviceConfig, 'id' | 'alias'> = {
      type: raw.type as 'browser' | 'android' | 'ios' | 'remote',
    };

    // Browser-specific
    if (raw.type === 'browser') {
      if (raw.viewport) {
        config.viewport = raw.viewport;
      }
      if (raw.startUrl) {
        config.startUrl = raw.startUrl;
      }
    }

    // Android-specific
    if (raw.type === 'android') {
      if (raw.device) {
        config.deviceId = raw.device;
      }
      if (raw.package) {
        config.package = raw.package;
      }
    }

    // iOS-specific
    if (raw.type === 'ios') {
      if (raw.wdaHost) {
        config.wdaHost = raw.wdaHost;
      }
      if (raw.wdaPort) {
        config.wdaPort = raw.wdaPort;
      }
    }

    // Remote-specific
    if (raw.type === 'remote') {
      if (raw.wsUrl) {
        config.wsUrl = raw.wsUrl;
      }
    }

    return { config };
  }

  /**
   * Parse a flow step
   */
  private parseFlowStep(
    raw: RawFlowStep,
    deviceAliases: string[],
    index: number,
  ): { step?: FlowStep; errors: ParseError[]; warnings: string[] } {
    const errors: ParseError[] = [];
    const warnings: string[] = [];

    // Sync step
    if (raw.sync !== undefined) {
      const syncStep: SyncFlowStep = {
        type: 'sync',
        id: raw.sync,
        timeout: raw.timeout,
      };
      return { step: syncStep, errors: [], warnings: [] };
    }

    // Parallel step
    if (raw.blocks && Array.isArray(raw.blocks)) {
      const blocks: DeviceFlowStep[] = [];

      for (let i = 0; i < raw.blocks.length; i++) {
        const blockResult = this.parseFlowStep(raw.blocks[i], deviceAliases, i);
        if (blockResult.errors.length > 0) {
          errors.push(...blockResult.errors);
        }
        if (blockResult.warnings.length > 0) {
          warnings.push(...blockResult.warnings);
        }
        if (blockResult.step && blockResult.step.type === 'device') {
          blocks.push(blockResult.step);
        }
      }

      const parallelStep: ParallelFlowStep = {
        type: 'parallel',
        blocks,
      };

      return { step: parallelStep, errors, warnings };
    }

    // Device step
    if (raw.device) {
      if (!deviceAliases.includes(raw.device)) {
        errors.push({
          message: `Flow step ${index + 1}: unknown device "${raw.device}"`,
        });
        return { errors, warnings };
      }

      if (!raw.steps || raw.steps.length === 0) {
        warnings.push(`Flow step ${index + 1}: empty steps array`);
      }

      const steps: ActionStep[] = (raw.steps || []).map((rawAction) =>
        this.parseActionStep(rawAction),
      );

      const deviceStep: DeviceFlowStep = {
        type: 'device',
        name: raw.name,
        device: raw.device,
        parallel: raw.parallel,
        steps,
      };

      return { step: deviceStep, errors, warnings };
    }

    errors.push({
      message: `Flow step ${index + 1}: invalid step - must have 'device', 'sync', or 'blocks'`,
    });

    return { errors, warnings };
  }

  /**
   * Parse an action step
   */
  private parseActionStep(raw: RawActionStep): ActionStep {
    return {
      ai: raw.ai,
      assert: raw.assert,
      export: raw.export,
      waitFor: raw.waitFor,
      navigate: raw.navigate,
    };
  }

  /**
   * Validate a parsed script
   */
  validate(script: CollaborativeScript): string[] {
    const errors: string[] = [];

    // Check for referenced variables
    const definedVars = new Set(Object.keys(script.variables || {}));
    const referencedVars = this.findVariableReferences(script);

    for (const varRef of referencedVars) {
      if (!definedVars.has(varRef)) {
        // Check if it will be exported by a previous step
        if (!this.isExportedVariable(script, varRef)) {
          errors.push(
            `Variable "${varRef}" is referenced but not defined in variables or exported by previous steps`,
          );
        }
      }
    }

    // Check device references
    const deviceAliases = new Set(Object.keys(script.devices));
    for (const step of script.flow) {
      if (step.type === 'device') {
        if (!deviceAliases.has(step.device)) {
          errors.push(`Unknown device: "${step.device}"`);
        }
      } else if (step.type === 'parallel') {
        for (const block of step.blocks) {
          if (!deviceAliases.has(block.device)) {
            errors.push(`Unknown device in parallel block: "${block.device}"`);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Find all variable references in a script
   */
  private findVariableReferences(script: CollaborativeScript): Set<string> {
    const refs = new Set<string>();
    const regex = /\$\{(\w+)(?:\s*\|[^}]*)?\}/g;

    const searchString = (str: string | undefined) => {
      if (!str) return;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(str)) !== null) {
        refs.add(match[1]);
      }
    };

    for (const step of script.flow) {
      if (step.type === 'device') {
        for (const action of step.steps) {
          searchString(action.ai);
          searchString(action.assert);
          searchString(action.waitFor);
          searchString(action.navigate);
        }
      } else if (step.type === 'parallel') {
        for (const block of step.blocks) {
          for (const action of block.steps) {
            searchString(action.ai);
            searchString(action.assert);
            searchString(action.waitFor);
            searchString(action.navigate);
          }
        }
      }
    }

    return refs;
  }

  /**
   * Check if a variable is exported by a previous step
   */
  private isExportedVariable(
    script: CollaborativeScript,
    varName: string,
  ): boolean {
    for (const step of script.flow) {
      if (step.type === 'device') {
        for (const action of step.steps) {
          if (action.export && varName in action.export) {
            return true;
          }
        }
      } else if (step.type === 'parallel') {
        for (const block of step.blocks) {
          for (const action of block.steps) {
            if (action.export && varName in action.export) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Generate YAML from script
   */
  stringify(script: CollaborativeScript): string {
    const obj: any = {
      name: script.name,
    };

    if (script.description) {
      obj.description = script.description;
    }

    obj.devices = {};
    for (const [alias, config] of Object.entries(script.devices)) {
      obj.devices[alias] = this.deviceConfigToRaw(config);
    }

    if (script.variables && Object.keys(script.variables).length > 0) {
      obj.variables = script.variables;
    }

    obj.flow = script.flow.map((step) => this.flowStepToRaw(step));

    return yaml.dump(obj, {
      lineWidth: 120,
      noRefs: true,
      quotingType: '"',
    });
  }

  /**
   * Convert device config to raw format
   */
  private deviceConfigToRaw(
    config: Omit<DeviceConfig, 'id' | 'alias'>,
  ): RawDevice {
    const raw: RawDevice = {
      type: config.type,
    };

    if (config.viewport) {
      raw.viewport = config.viewport;
    }
    if (config.startUrl) {
      raw.startUrl = config.startUrl;
    }
    if (config.deviceId) {
      raw.device = config.deviceId;
    }
    if (config.package) {
      raw.package = config.package;
    }
    if (config.wdaHost) {
      raw.wdaHost = config.wdaHost;
    }
    if (config.wdaPort) {
      raw.wdaPort = config.wdaPort;
    }
    if (config.wsUrl) {
      raw.wsUrl = config.wsUrl;
    }

    return raw;
  }

  /**
   * Convert flow step to raw format
   */
  private flowStepToRaw(step: FlowStep): RawFlowStep {
    if (step.type === 'sync') {
      return {
        sync: step.id,
        timeout: step.timeout,
      };
    }

    if (step.type === 'parallel') {
      return {
        blocks: step.blocks.map((block) => this.flowStepToRaw(block)),
      };
    }

    // Device step
    const raw: RawFlowStep = {
      device: step.device,
      steps: step.steps.map((action) => this.actionStepToRaw(action)),
    };

    if (step.name) {
      raw.name = step.name;
    }
    if (step.parallel) {
      raw.parallel = step.parallel;
    }

    return raw;
  }

  /**
   * Convert action step to raw format
   */
  private actionStepToRaw(action: ActionStep): RawActionStep {
    const raw: RawActionStep = {};

    if (action.ai) {
      raw.ai = action.ai;
    }
    if (action.assert) {
      raw.assert = action.assert;
    }
    if (action.export) {
      raw.export = action.export;
    }
    if (action.waitFor) {
      raw.waitFor = action.waitFor;
    }
    if (action.navigate) {
      raw.navigate = action.navigate;
    }

    return raw;
  }
}

/**
 * Create script parser instance
 */
export function createScriptParser(): ScriptParser {
  return new ScriptParser();
}
