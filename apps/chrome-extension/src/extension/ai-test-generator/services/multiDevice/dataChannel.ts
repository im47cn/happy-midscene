/**
 * Data Channel
 * Manages shared data across multiple device sessions with variable interpolation
 */

import type { DataTransformer, VariableRef } from '../../types/multiDevice';

/**
 * Data change event
 */
export interface DataChangeEvent {
  key: string;
  value: any;
  previousValue?: any;
  source: string;
  timestamp: number;
}

/**
 * Data change listener
 */
export type DataChangeListener = (event: DataChangeEvent) => void;

/**
 * Subscription for specific key
 */
export type KeySubscription = (value: any) => void;

/**
 * Data Channel for cross-device data sharing
 */
export class DataChannel {
  private data: Map<string, any> = new Map();
  private history: DataChangeEvent[] = [];
  private maxHistorySize: number;
  private listeners: Set<DataChangeListener> = new Set();
  private keySubscribers: Map<string, Set<KeySubscription>> = new Map();

  constructor(maxHistorySize = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Set a value in the shared data
   */
  set(key: string, value: any, source = 'unknown'): void {
    const previousValue = this.data.get(key);
    this.data.set(key, value);

    const event: DataChangeEvent = {
      key,
      value,
      previousValue,
      source,
      timestamp: Date.now(),
    };

    // Add to history
    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Notify global listeners
    this.emit(event);

    // Notify key subscribers
    const keySubscribers = this.keySubscribers.get(key);
    if (keySubscribers) {
      for (const subscriber of keySubscribers) {
        try {
          subscriber(value);
        } catch (error) {
          console.warn('Key subscriber error:', error);
        }
      }
    }
  }

  /**
   * Get a value from shared data
   */
  get(key: string): any {
    return this.data.get(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.data.has(key);
  }

  /**
   * Delete a key
   */
  delete(key: string): boolean {
    const hadKey = this.data.has(key);
    if (hadKey) {
      const previousValue = this.data.get(key);
      this.data.delete(key);

      this.emit({
        key,
        value: undefined,
        previousValue,
        source: 'delete',
        timestamp: Date.now(),
      });
    }
    return hadKey;
  }

  /**
   * Get all data as object
   */
  getAll(): Record<string, any> {
    return Object.fromEntries(this.data);
  }

  /**
   * Set multiple values at once
   */
  setMultiple(values: Record<string, any>, source = 'unknown'): void {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value, source);
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data.clear();
    this.history = [];
  }

  /**
   * Get change history
   */
  getHistory(): DataChangeEvent[] {
    return [...this.history];
  }

  /**
   * Subscribe to changes for a specific key
   */
  subscribe(key: string, callback: KeySubscription): () => void {
    if (!this.keySubscribers.has(key)) {
      this.keySubscribers.set(key, new Set());
    }
    this.keySubscribers.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.keySubscribers.get(key)?.delete(callback);
    };
  }

  /**
   * Add global change listener
   */
  addEventListener(listener: DataChangeListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove global change listener
   */
  removeEventListener(listener: DataChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit change event
   */
  private emit(event: DataChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('Data change listener error:', error);
      }
    }
  }

  /**
   * Interpolate variables in a template string
   * Supports: ${key}, ${key | transformer}, ${key | transformer:'arg'}
   */
  interpolate(template: string): string {
    return template.replace(
      /\$\{(\w+)(?:\s*\|\s*(\w+)(?::'([^']*)')?)?\}/g,
      (match, key, transformer, arg) => {
        let value = this.get(key);

        if (value === undefined) {
          return match;
        }

        if (transformer) {
          value = this.transform(value, transformer as DataTransformer, arg);
        }

        return String(value);
      },
    );
  }

  /**
   * Parse variable reference from string
   */
  parseVariableRef(ref: string): VariableRef | null {
    const match = ref.match(/^\$\{(\w+)(?:\s*\|\s*(\w+)(?::'([^']*)')?)?\}$/);
    if (!match) {
      return null;
    }

    return {
      key: match[1],
      transformer: match[2] as DataTransformer | undefined,
      transformerArg: match[3],
    };
  }

  /**
   * Transform a value
   */
  transform(
    value: any,
    transformer: DataTransformer,
    arg?: string,
  ): any {
    switch (transformer) {
      case 'trim':
        return String(value).trim();

      case 'number':
        return Number(value);

      case 'uppercase':
        return String(value).toUpperCase();

      case 'lowercase':
        return String(value).toLowerCase();

      case 'format':
        return this.formatValue(value, arg);

      default:
        return value;
    }
  }

  /**
   * Format a value with a format string
   */
  private formatValue(value: any, format?: string): string {
    if (!format) {
      return String(value);
    }

    // Date formatting
    if (value instanceof Date || !Number.isNaN(Date.parse(value))) {
      const date = value instanceof Date ? value : new Date(value);
      return this.formatDate(date, format);
    }

    // Number formatting
    if (typeof value === 'number' || !Number.isNaN(Number(value))) {
      return this.formatNumber(Number(value), format);
    }

    return String(value);
  }

  /**
   * Format a date
   */
  private formatDate(date: Date, format: string): string {
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return format
      .replace('YYYY', String(date.getFullYear()))
      .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
      .replace('DD', String(date.getDate()).padStart(2, '0'))
      .replace('HH', String(date.getHours()).padStart(2, '0'))
      .replace('mm', String(date.getMinutes()).padStart(2, '0'))
      .replace('ss', String(date.getSeconds()).padStart(2, '0'));
  }

  /**
   * Format a number
   */
  private formatNumber(num: number, format: string): string {
    // Support patterns like "0.00", "0,000.00", "$0.00"
    const prefix = format.match(/^[^0#,.]*/)?.[0] || '';
    const suffix = format.match(/[^0#,.]*$/)?.[0] || '';
    const pattern = format.slice(prefix.length, format.length - suffix.length);

    let formatted = num.toString();

    // Check for decimal places
    const decimalMatch = pattern.match(/\.([0#]+)$/);
    if (decimalMatch) {
      const decimalPlaces = decimalMatch[1].length;
      formatted = num.toFixed(decimalPlaces);
    }

    // Add thousand separators
    if (pattern.includes(',')) {
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formatted = parts.join('.');
    }

    return prefix + formatted + suffix;
  }

  /**
   * Evaluate a simple expression with variables
   * Supports: +, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||
   */
  evaluate(expression: string): any {
    // First interpolate variables
    const interpolated = this.interpolate(expression);

    // Simple expression evaluation (for safety, only support basic operators)
    try {
      // Only allow numbers, operators, and parentheses
      if (!/^[\d\s+\-*/%().<>=!&|]+$/.test(interpolated)) {
        return interpolated;
      }

      // Use Function constructor for safe evaluation
      return new Function(`return (${interpolated})`)();
    } catch {
      return interpolated;
    }
  }

  /**
   * Clone the data channel
   */
  clone(): DataChannel {
    const newChannel = new DataChannel(this.maxHistorySize);
    for (const [key, value] of this.data) {
      newChannel.data.set(key, value);
    }
    return newChannel;
  }
}

/**
 * Create data channel instance
 */
export function createDataChannel(maxHistorySize?: number): DataChannel {
  return new DataChannel(maxHistorySize);
}
