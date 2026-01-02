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
