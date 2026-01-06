/**
 * Configuration Loader
 *
 * Loads configuration from JSON or YAML files.
 */

import { readFileSync } from 'node:fs';
import * as yaml from 'js-yaml';

/**
 * Load JSON file
 */
export function loadJSONFile<T = unknown>(path: string): T {
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Load YAML file
 */
export function loadYAMLFile<T = unknown>(path: string): T {
  const content = readFileSync(path, 'utf-8');
  return yaml.load(content) as T;
}
