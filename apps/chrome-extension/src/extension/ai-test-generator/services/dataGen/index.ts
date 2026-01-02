/**
 * Smart Data Generation Module
 * Exports all data generation functionality
 */

// Core generators
export {
  generators,
  generateForSemanticType,
  generateMobilePhone,
  generateEmail,
  generateRealName,
  generateUsername,
  generateNickname,
  generatePassword,
  generateIdCard,
  generateBankCard,
  generatePostalCode,
  generateAddress,
  generateCity,
  generateProvince,
  generateDateOfBirth,
  generateAmount,
  generateQuantity,
  generateDescription,
  generateUrl,
  generateCompany,
  generateJobTitle,
  generateCaptcha,
  generateLandline,
} from './generators';

// Data Generator
export { DataGenerator, dataGenerator } from './dataGenerator';

// Boundary Engine
export {
  generateBoundaryTestCases,
  analyzeBoundaryCoverage,
} from './boundaryEngine';

// Data Masker
export {
  DataMasker,
  dataMasker,
  maskValue,
  isSensitiveType,
} from './dataMasker';

// Template Manager
export { TemplateManager, templateManager } from './templateManager';

// Data Pool Manager
export { DataPoolManager, dataPoolManager } from './dataPoolManager';

// Semantic Parser
export {
  parseSemanticType,
  parseSemanticTypeWithConfidence,
  parseFieldType,
  extractConstraints,
  getSemanticKeywords,
  addSemanticKeywords,
} from './semanticParser';

// Field Recognizer
export {
  FieldRecognizer,
  fieldRecognizer,
  createFieldDefinition,
  createFormFields,
  type RawFieldInfo,
  type RecognizedField,
  type RecognizeOptions,
} from './fieldRecognizer';

// Smart Input Executor
export {
  SmartInputExecutor,
  smartInputExecutor,
  type SmartInputRecord,
} from './smartInputExecutor';
