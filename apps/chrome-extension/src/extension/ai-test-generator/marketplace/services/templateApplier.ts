/**
 * Template Applier Service
 * Applies templates by replacing parameters and generating YAML
 */

import type {
  ITemplateApplier,
  ParameterDef,
  Template,
} from '../types';

/**
 * Template applier implementation
 */
export class TemplateApplier implements ITemplateApplier {
  /**
   * Apply parameters to a template and generate YAML
   */
  apply(template: Template, params: Record<string, unknown>): string {
    let yaml = template.content.yaml;

    // Replace all parameters
    for (const [key, value] of Object.entries(params)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
      yaml = yaml.replace(regex, String(value ?? ''));
    }

    // Replace any remaining unreplaced parameters with empty string
    yaml = yaml.replace(/\$\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, '');

    return yaml;
  }

  /**
   * Validate parameters against their definitions
   */
  validateParams(
    parameters: ParameterDef[],
    values: Record<string, unknown>
  ): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const param of parameters) {
      const value = values[param.name];
      const stringValue = value !== undefined ? String(value) : '';

      // Check required
      if (param.required && (value === undefined || value === null || stringValue === '')) {
        errors[param.name] = `${param.label} is required`;
        continue;
      }

      // Skip validation if value is empty and not required
      if (!stringValue && !param.required) {
        continue;
      }

      // Validate based on type
      switch (param.type) {
        case 'number':
          if (Number.isNaN(Number(value))) {
            errors[param.name] = `${param.label} must be a valid number`;
          } else if (param.validation) {
            const numValue = Number(value);
            if (param.validation.min !== undefined && numValue < param.validation.min) {
              errors[param.name] = `${param.label} must be at least ${param.validation.min}`;
            }
            if (param.validation.max !== undefined && numValue > param.validation.max) {
              errors[param.name] = `${param.label} must be at most ${param.validation.max}`;
            }
          }
          break;

        case 'url':
          try {
            new URL(stringValue);
          } catch {
            errors[param.name] = `${param.label} must be a valid URL`;
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            errors[param.name] = `${param.label} must be true or false`;
          }
          break;

        case 'select':
          if (param.options && !param.options.some((opt) => opt.value === value)) {
            errors[param.name] = `${param.label} must be one of the available options`;
          }
          break;

        case 'string':
        case 'password':
        default:
          if (param.validation) {
            if (param.validation.minLength !== undefined && stringValue.length < param.validation.minLength) {
              errors[param.name] = `${param.label} must be at least ${param.validation.minLength} characters`;
            }
            if (param.validation.maxLength !== undefined && stringValue.length > param.validation.maxLength) {
              errors[param.name] = `${param.label} must be at most ${param.validation.maxLength} characters`;
            }
            if (param.validation.pattern) {
              const regex = new RegExp(param.validation.pattern);
              if (!regex.test(stringValue)) {
                errors[param.name] = `${param.label} format is invalid`;
              }
            }
          }
          break;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Get default values for all parameters
   */
  getDefaultParams(parameters: ParameterDef[]): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};

    for (const param of parameters) {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      } else {
        // Set type-appropriate empty defaults
        switch (param.type) {
          case 'boolean':
            defaults[param.name] = false;
            break;
          case 'number':
            defaults[param.name] = 0;
            break;
          case 'select':
            defaults[param.name] = param.options?.[0]?.value ?? '';
            break;
          default:
            defaults[param.name] = '';
        }
      }
    }

    return defaults;
  }

  /**
   * Preview YAML with parameters applied
   */
  previewYaml(template: Template, params: Record<string, unknown>): string {
    return this.apply(template, params);
  }

  /**
   * Extract parameter names from YAML content
   */
  extractParameters(yaml: string): string[] {
    const regex = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    const matches = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(yaml)) !== null) {
      matches.add(match[1]);
    }

    return Array.from(matches);
  }

  /**
   * Check if all required parameters are provided
   */
  hasAllRequiredParams(parameters: ParameterDef[], values: Record<string, unknown>): boolean {
    return parameters
      .filter((p) => p.required)
      .every((p) => {
        const value = values[p.name];
        return value !== undefined && value !== null && String(value) !== '';
      });
  }
}

// Export singleton instance
export const templateApplier = new TemplateApplier();
