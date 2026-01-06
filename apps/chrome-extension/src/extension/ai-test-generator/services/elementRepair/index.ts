/**
 * Element Repair Service Module
 * Exports all element repair related services
 */

export { ElementSelectorService, elementSelector } from './elementSelector';
export { RepairEngine, repairEngine } from './repairEngine';
export type {
  ElementPickerConfig,
  ElementSelector as SelectorType,
  RepairActionType,
  RepairOptions,
  RepairResult,
  RepairSuggestion,
  SelectedElement,
  SelectionMode,
  SelectionState,
} from '../../types/elementRepair';
export type { IElementSelector, IRepairEngine } from '../../types/elementRepair';
