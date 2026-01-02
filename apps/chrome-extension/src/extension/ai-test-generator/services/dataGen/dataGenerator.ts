/**
 * Data Generator
 * Core engine for generating test data based on field definitions
 */

import type {
  FieldDefinition,
  GenerateOptions,
  GeneratedData,
  FormGenerationResult,
  BoundaryTestCase,
  DataGenConfig,
  IDataGenerator,
} from '../../types/dataGen';
import { DEFAULT_DATA_GEN_CONFIG } from '../../types/dataGen';
import { generateForSemanticType } from './generators';
import { generateBoundaryTestCases } from './boundaryEngine';
import { maskValue, isSensitiveType } from './dataMasker';

/**
 * Data Generator implementation
 */
export class DataGenerator implements IDataGenerator {
  private config: DataGenConfig;

  constructor(config: Partial<DataGenConfig> = {}) {
    this.config = { ...DEFAULT_DATA_GEN_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<DataGenConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): DataGenConfig {
    return { ...this.config };
  }

  /**
   * Generate data for a single field
   */
  async generate(
    field: FieldDefinition,
    options: GenerateOptions = {}
  ): Promise<unknown> {
    if (!this.config.enabled) {
      return null;
    }

    const locale = options.locale || this.config.defaultLocale;

    try {
      // Generate value based on semantic type
      const value = generateForSemanticType(
        field.semanticType,
        field.constraints,
        locale
      );

      return value;
    } catch (error) {
      console.error(`Failed to generate data for field ${field.id}:`, error);
      throw error;
    }
  }

  /**
   * Generate data for multiple fields (form)
   */
  async generateForForm(
    fields: FieldDefinition[]
  ): Promise<FormGenerationResult> {
    const result: Record<string, GeneratedData> = {};
    const timestamp = Date.now();

    for (const field of fields) {
      try {
        const value = await this.generate(field);

        const generatedData: GeneratedData = {
          fieldId: field.id,
          value,
          generator: field.semanticType,
          timestamp,
        };

        // Apply masking if configured
        if (this.config.autoMask && isSensitiveType(field.semanticType)) {
          generatedData.maskedValue = maskValue(value, field.semanticType);
        }

        result[field.id] = generatedData;
      } catch (error) {
        console.error(`Failed to generate data for field ${field.id}:`, error);
        // Continue with other fields
      }
    }

    return {
      fields: result,
      timestamp,
    };
  }

  /**
   * Generate boundary test cases for a field
   */
  async generateBoundaryValues(
    field: FieldDefinition
  ): Promise<BoundaryTestCase[]> {
    if (!this.config.generateBoundaryValues) {
      return [];
    }

    return generateBoundaryTestCases(field);
  }

  /**
   * Generate multiple variations for a field
   */
  async generateVariations(
    field: FieldDefinition,
    count: number = 5
  ): Promise<unknown[]> {
    const variations: unknown[] = [];

    for (let i = 0; i < count; i++) {
      const value = await this.generate(field);
      variations.push(value);
    }

    return variations;
  }
}

/**
 * Default generator instance
 */
export const dataGenerator = new DataGenerator();
