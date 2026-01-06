/**
 * Visual Test Designer - Type Definitions
 *
 * Core types for the visual flow-based test designer
 */

import type { Node, Edge } from '@xyflow/react';

// ============================================================================
// Node Types
// ============================================================================

export type NodeType =
  // Special nodes
  | 'start'
  | 'end'
  | 'comment'
  // Action nodes
  | 'click'
  | 'input'
  | 'scroll'
  | 'wait'
  | 'navigate'
  | 'hover'
  | 'drag'
  // Validation nodes
  | 'assertExists'
  | 'assertText'
  | 'assertState'
  | 'aiAssert'
  // Control nodes
  | 'ifElse'
  | 'loop'
  | 'parallel'
  | 'group'
  // Data nodes
  | 'setVariable'
  | 'extractData'
  | 'externalData';

export type NodeCategory = 'action' | 'validation' | 'control' | 'data' | 'special';

// ============================================================================
// Node Configuration Types
// ============================================================================

export interface BaseNodeConfig {
  description?: string;
  timeout?: number;
  onFailure?: 'stop' | 'skip' | 'retry';
}

export interface ClickNodeConfig extends BaseNodeConfig {
  target: string;
}

export interface InputNodeConfig extends BaseNodeConfig {
  target: string;
  value: string;
  clearBefore?: boolean;
}

export interface ScrollNodeConfig extends BaseNodeConfig {
  target?: string;
  direction: 'up' | 'down' | 'left' | 'right' | 'intoView';
  amount?: number;
}

export interface WaitNodeConfig extends BaseNodeConfig {
  duration: number;
  unit?: 'ms' | 's';
}

export interface NavigateNodeConfig extends BaseNodeConfig {
  url: string;
  waitFor?: 'load' | 'domContentLoaded' | 'networkIdle';
}

export interface HoverNodeConfig extends BaseNodeConfig {
  target: string;
}

export interface DragNodeConfig extends BaseNodeConfig {
  target: string;
  destination: string;
  duration?: number;
}

export interface AssertExistsNodeConfig extends BaseNodeConfig {
  target: string;
  shouldExist: boolean;
}

export interface AssertTextNodeConfig extends BaseNodeConfig {
  target: string;
  text: string;
  matchType?: 'exact' | 'contains' | 'regex';
}

export interface AssertStateNodeConfig extends BaseNodeConfig {
  target: string;
  state: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'checked' | 'unchecked';
}

export interface AiAssertNodeConfig extends BaseNodeConfig {
  assertion: string;
}

export interface IfElseNodeConfig extends BaseNodeConfig {
  condition: string;
  trueLabel?: string;
  falseLabel?: string;
}

export interface LoopNodeConfig extends BaseNodeConfig {
  type: 'count' | 'while' | 'forEach';
  count?: number;
  condition?: string;
  dataSource?: string;
  itemVariable?: string;
}

export interface ParallelNodeConfig extends BaseNodeConfig {
  maxConcurrency?: number;
  failFast?: boolean;
}

export interface GroupNodeConfig extends BaseNodeConfig {
  label: string;
  collapsed?: boolean;
}

export interface SetVariableNodeConfig extends BaseNodeConfig {
  name: string;
  value: string;
}

export interface ExtractDataNodeConfig extends BaseNodeConfig {
  target: string;
  variableName: string;
  extractType?: 'text' | 'attribute' | 'ai';
  attribute?: string;
}

export interface ExternalDataNodeConfig extends BaseNodeConfig {
  source: string;
  format?: 'json' | 'csv' | 'api';
}

export interface CommentNodeConfig {
  content: string;
}

export type NodeConfig =
  | ClickNodeConfig
  | InputNodeConfig
  | ScrollNodeConfig
  | WaitNodeConfig
  | NavigateNodeConfig
  | HoverNodeConfig
  | DragNodeConfig
  | AssertExistsNodeConfig
  | AssertTextNodeConfig
  | AssertStateNodeConfig
  | AiAssertNodeConfig
  | IfElseNodeConfig
  | LoopNodeConfig
  | ParallelNodeConfig
  | GroupNodeConfig
  | SetVariableNodeConfig
  | ExtractDataNodeConfig
  | ExternalDataNodeConfig
  | CommentNodeConfig;

// ============================================================================
// Flow Types
// ============================================================================

export interface NodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  config: NodeConfig;
  errors?: string[];
}

export interface FlowNode extends Node {
  type: NodeType;
  data: NodeData;
}

export interface FlowEdge extends Edge {
  sourceHandle?: string;
  targetHandle?: string;
  data?: {
    condition?: string;
    label?: string;
  };
}

export interface VariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  defaultValue?: unknown;
  description?: string;
}

export interface TestFlow {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: VariableDefinition[];
  metadata: {
    createdAt: number;
    updatedAt: number;
    author?: string;
  };
}

// ============================================================================
// Port Definitions
// ============================================================================

export interface PortDefinition {
  id: string;
  label: string;
  type: 'default' | 'conditional' | 'loop';
  maxConnections?: number;
}

// ============================================================================
// Node Definition (for Registry)
// ============================================================================

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  default?: unknown;
}

export interface JSONSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface NodeDefinition {
  type: NodeType;
  label: string;
  icon?: string;
  category: NodeCategory;
  configSchema: JSONSchema;
  defaultConfig: Record<string, unknown>;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  validate: (config: NodeConfig) => ValidationResult;
  toYaml: (node: FlowNode) => Record<string, unknown>[];
}

// ============================================================================
// YAML Step Types (for conversion)
// ============================================================================

export interface YamlStep {
  [key: string]: unknown;
}

export interface YamlScript {
  name?: string;
  description?: string;
  variables?: Record<string, unknown>;
  flow?: YamlStep[];
}

// ============================================================================
// Validator Types
// ============================================================================

export interface ValidationError {
  type: 'flow' | 'node' | 'edge';
  nodeId?: string;
  edgeId?: string;
  message: string;
}

export interface FlowValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// History/Undo Types
// ============================================================================

export interface HistoryEntry {
  nodes: FlowNode[];
  edges: FlowEdge[];
  timestamp: number;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ExecutionResult {
  success: boolean;
  errors: string[];
  duration: number;
}

export interface ExecutionOptions {
  onStepStart?: (stepIndex: number, nodeId: string) => void;
  onStepComplete?: (stepIndex: number, nodeId: string, success: boolean) => void;
  onProgress?: (current: number, total: number) => void;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rectangle extends Position, Size {}
