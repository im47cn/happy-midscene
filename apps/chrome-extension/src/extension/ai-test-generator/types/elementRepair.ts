/**
 * Element Repair Types for AI Test Generator
 * Provides type definitions for the element selection and repair feature
 */

import type { Rect } from '@midscene/core';

/**
 * Selection mode for element picker
 */
export type SelectionMode = 'click' | 'hover' | 'multi';

/**
 * State of element selection
 */
export type SelectionState = 'idle' | 'selecting' | 'selected' | 'validating';

/**
 * Repair action type
 */
export type RepairActionType =
  | 'update_selector'      // Update the element selector
  | 'add_fallback'         // Add fallback selector
  | 'update_description'   // Update semantic description
  | 'add_wait_condition';  // Add wait condition for element

/**
 * Selected element information
 */
export interface SelectedElement {
  // Element identification
  elementId: string;

  // Position info
  rect: Rect;
  center: [number, number];

  // Element attributes
  attributes: Record<string, string>;

  // Generated selectors
  suggestedSelectors: ElementSelector[];

  // AI semantic description
  semanticDescription?: string;

  // Screenshot (optional)
  screenshot?: string;
}

/**
 * Element selector suggestion
 */
export interface ElementSelector {
  type: 'css' | 'xpath' | 'text' | 'semantic' | 'data-testid';
  value: string;
  priority: number;       // 0-100, higher is better
  reason: string;         // Why this selector is suggested
}

/**
 * Repair suggestion
 */
export interface RepairSuggestion {
  id: string;

  // Action type
  actionType: RepairActionType;

  // Suggestion title and description
  title: string;
  description: string;

  // Current value
  currentValue: string;

  // Suggested value
  suggestedValue: string;

  // Confidence score
  confidence: number;

  // Estimated impact
  impact: 'high' | 'medium' | 'low';
}

/**
 * Repair options
 */
export interface RepairOptions {
  // Step ID to repair
  stepId: string;

  // Original step description
  originalDescription: string;

  // Original selector (if any)
  originalSelector?: string;

  // Failure reason
  failureReason: string;

  // Context: surrounding steps for better repair
  contextSteps?: string[];
}

/**
 * Repair result
 */
export interface RepairResult {
  success: boolean;
  repairId: string;

  // Applied repair
  appliedRepair: {
    actionType: RepairActionType;
    oldValue: string;
    newValue: string;
  };

  // Validation result
  validationResult?: {
    elementFound: boolean;
    elementPosition?: [number, number];
    validationScreenshot?: string;
  };

  // Timestamp
  timestamp: number;
}

/**
 * Element picker configuration
 */
export interface ElementPickerConfig {
  // Selection mode
  mode: SelectionMode;

  // Enable element highlighting
  highlightElements: boolean;

  // Show element info tooltip
  showTooltip: boolean;

  // Filter invisible elements
  filterInvisible: boolean;

  // Minimum element size (px)
  minElementSize: number;

  // Allowed tag names (empty = all)
  allowedTags: string[];

  // Blocked tag names
  blockedTags: string[];
}

/**
 * Default configuration
 */
export const DEFAULT_ELEMENT_PICKER_CONFIG: ElementPickerConfig = {
  mode: 'click',
  highlightElements: true,
  showTooltip: true,
  filterInvisible: true,
  minElementSize: 5,
  allowedTags: [],
  blockedTags: ['html', 'head', 'style', 'script', 'meta', 'link', 'noscript'],
};

/**
 * Interface for element selector service
 */
export interface IElementSelector {
  // Start selection mode
  startSelection(config?: Partial<ElementPickerConfig>): Promise<void>;

  // Stop selection mode
  stopSelection(): void;

  // Get current selection state
  getSelectionState(): SelectionState;

  // Get selected element
  getSelectedElement(): SelectedElement | null;

  // Clear selection
  clearSelection(): void;

  // Highlight element at position
  highlightElement(x: number, y: number): Promise<SelectedElement | null>;

  // Generate selectors for element
  generateSelectors(element: HTMLElement): ElementSelector[];

  // Validate selector
  validateSelector(selector: string): Promise<boolean>;
}

/**
 * Interface for repair engine
 */
export interface IRepairEngine {
  // Generate repair suggestions based on selected element
  generateSuggestions(
    selectedElement: SelectedElement,
    options: RepairOptions,
  ): Promise<RepairSuggestion[]>;

  // Apply repair suggestion
  applyRepair(
    suggestion: RepairSuggestion,
    selectedElement: SelectedElement,
    options: RepairOptions,
  ): Promise<RepairResult>;

  // Validate repair result
  validateRepair(result: RepairResult): Promise<boolean>;

  // Get repair history
  getRepairHistory(stepId?: string): Promise<RepairResult[]>;
}
