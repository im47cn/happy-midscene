/**
 * Smart Assertion System - Service Exports
 */

// Core services
export { contextCollector, ContextCollector } from './contextCollector';
export { changeDetector, ChangeDetector } from './changeDetector';
export { intentInferrer, IntentInferrer } from './intentInferrer';
export { assertionGenerator, AssertionGenerator } from './assertionGenerator';
export { assertionValidator, AssertionValidator } from './assertionValidator';
export { templateManager, TemplateManager } from './templateManager';

// Strategies
export * from './strategies';
