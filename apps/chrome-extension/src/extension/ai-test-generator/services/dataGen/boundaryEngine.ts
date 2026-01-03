/**
 * Boundary Engine
 * Generates boundary test cases for field validation testing
 */

import type {
  BoundaryTestCase,
  FieldConstraints,
  FieldDefinition,
} from '../../types/dataGen';

/**
 * Generate boundary test cases for a field
 */
export function generateBoundaryTestCases(
  field: FieldDefinition,
): BoundaryTestCase[] {
  const testCases: BoundaryTestCase[] = [];
  const { constraints, semanticType } = field;

  // Generate length boundary cases
  if (
    constraints.minLength !== undefined ||
    constraints.maxLength !== undefined
  ) {
    testCases.push(...generateLengthBoundaries(constraints, semanticType));
  }

  // Generate value boundary cases for numeric types
  if (
    constraints.minValue !== undefined ||
    constraints.maxValue !== undefined
  ) {
    testCases.push(...generateValueBoundaries(constraints));
  }

  // Generate special value cases
  testCases.push(...generateSpecialCases(field));

  // Generate empty value case
  if (constraints.required) {
    testCases.push({
      name: '空值',
      value: '',
      expectedResult: 'invalid',
      description: '必填字段不能为空',
      category: 'empty',
    });
  } else {
    testCases.push({
      name: '空值',
      value: '',
      expectedResult: 'valid',
      description: '非必填字段可以为空',
      category: 'empty',
    });
  }

  return testCases;
}

/**
 * Generate length boundary test cases
 */
function generateLengthBoundaries(
  constraints: FieldConstraints,
  semanticType: string,
): BoundaryTestCase[] {
  const cases: BoundaryTestCase[] = [];
  const chars = 'a'; // Use simple character for length tests

  // Minimum length
  if (constraints.minLength !== undefined && constraints.minLength > 0) {
    const minLen = constraints.minLength;

    // Exact minimum (valid)
    cases.push({
      name: `最小长度 (${minLen}字符)`,
      value: chars.repeat(minLen),
      expectedResult: 'valid',
      description: `正好${minLen}个字符，符合最小长度要求`,
      category: 'min',
    });

    // Below minimum (invalid)
    if (minLen > 1) {
      cases.push({
        name: `低于最小长度 (${minLen - 1}字符)`,
        value: chars.repeat(minLen - 1),
        expectedResult: 'invalid',
        description: `${minLen - 1}个字符，少于最小长度${minLen}`,
        category: 'boundary-1',
      });
    }
  }

  // Maximum length
  if (constraints.maxLength !== undefined) {
    const maxLen = constraints.maxLength;

    // Exact maximum (valid)
    cases.push({
      name: `最大长度 (${maxLen}字符)`,
      value: chars.repeat(maxLen),
      expectedResult: 'valid',
      description: `正好${maxLen}个字符，符合最大长度要求`,
      category: 'max',
    });

    // Above maximum (invalid)
    cases.push({
      name: `超过最大长度 (${maxLen + 1}字符)`,
      value: chars.repeat(maxLen + 1),
      expectedResult: 'invalid',
      description: `${maxLen + 1}个字符，超过最大长度${maxLen}`,
      category: 'boundary+1',
    });
  }

  return cases;
}

/**
 * Generate value boundary test cases for numeric fields
 */
function generateValueBoundaries(
  constraints: FieldConstraints,
): BoundaryTestCase[] {
  const cases: BoundaryTestCase[] = [];

  // Minimum value
  if (constraints.minValue !== undefined) {
    const minVal = constraints.minValue;

    // Exact minimum (valid)
    cases.push({
      name: `最小值 (${minVal})`,
      value: minVal,
      expectedResult: 'valid',
      description: `正好等于最小值${minVal}`,
      category: 'min',
    });

    // Below minimum (invalid)
    cases.push({
      name: `低于最小值 (${minVal - 1})`,
      value: minVal - 1,
      expectedResult: 'invalid',
      description: `${minVal - 1}，小于最小值${minVal}`,
      category: 'boundary-1',
    });
  }

  // Maximum value
  if (constraints.maxValue !== undefined) {
    const maxVal = constraints.maxValue;

    // Exact maximum (valid)
    cases.push({
      name: `最大值 (${maxVal})`,
      value: maxVal,
      expectedResult: 'valid',
      description: `正好等于最大值${maxVal}`,
      category: 'max',
    });

    // Above maximum (invalid)
    cases.push({
      name: `超过最大值 (${maxVal + 1})`,
      value: maxVal + 1,
      expectedResult: 'invalid',
      description: `${maxVal + 1}，大于最大值${maxVal}`,
      category: 'boundary+1',
    });
  }

  return cases;
}

/**
 * Generate special character test cases
 */
function generateSpecialCases(field: FieldDefinition): BoundaryTestCase[] {
  const cases: BoundaryTestCase[] = [];
  const { semanticType, constraints } = field;

  // SQL injection test (should be rejected or sanitized)
  cases.push({
    name: 'SQL注入测试',
    value: "'; DROP TABLE users; --",
    expectedResult: 'invalid',
    description: '包含SQL注入字符，应被拒绝或转义',
    category: 'special',
  });

  // XSS test
  cases.push({
    name: 'XSS攻击测试',
    value: '<script>alert("xss")</script>',
    expectedResult: 'invalid',
    description: '包含XSS攻击代码，应被拒绝或转义',
    category: 'special',
  });

  // Based on semantic type, add specific special cases
  switch (semanticType) {
    case 'email':
      cases.push({
        name: '无效邮箱格式',
        value: 'invalid-email',
        expectedResult: 'invalid',
        description: '缺少@符号，不是有效邮箱格式',
        category: 'special',
      });
      cases.push({
        name: '邮箱缺少域名',
        value: 'test@',
        expectedResult: 'invalid',
        description: '缺少域名部分',
        category: 'special',
      });
      break;

    case 'mobile_phone':
      cases.push({
        name: '无效手机号前缀',
        value: '12012345678',
        expectedResult: 'invalid',
        description: '120不是有效的手机号前缀',
        category: 'special',
      });
      cases.push({
        name: '手机号位数不足',
        value: '1381234567',
        expectedResult: 'invalid',
        description: '只有10位，应为11位',
        category: 'special',
      });
      break;

    case 'id_card':
      cases.push({
        name: '身份证位数不足',
        value: '11010119900101123',
        expectedResult: 'invalid',
        description: '只有17位，应为18位',
        category: 'special',
      });
      cases.push({
        name: '身份证校验位错误',
        value: '110101199001011230',
        expectedResult: 'invalid',
        description: '校验位不正确',
        category: 'special',
      });
      break;

    case 'amount':
      cases.push({
        name: '负数金额',
        value: -100,
        expectedResult:
          constraints.minValue !== undefined && constraints.minValue < 0
            ? 'valid'
            : 'invalid',
        description: '金额通常不能为负数',
        category: 'special',
      });
      break;

    case 'password':
      cases.push({
        name: '纯数字密码',
        value: '12345678',
        expectedResult: 'invalid',
        description: '密码应包含字母和特殊字符',
        category: 'special',
      });
      cases.push({
        name: '弱密码',
        value: 'password',
        expectedResult: 'invalid',
        description: '常见弱密码，应被拒绝',
        category: 'special',
      });
      break;

    case 'url':
      cases.push({
        name: '无效URL',
        value: 'not-a-url',
        expectedResult: 'invalid',
        description: '不是有效的URL格式',
        category: 'special',
      });
      break;

    case 'postal_code':
      cases.push({
        name: '邮编格式错误',
        value: '12345A',
        expectedResult: 'invalid',
        description: '邮编应为纯数字',
        category: 'special',
      });
      break;
  }

  // Whitespace test
  cases.push({
    name: '仅空格',
    value: '   ',
    expectedResult: constraints.required ? 'invalid' : 'valid',
    description: '仅包含空格的输入',
    category: 'special',
  });

  // Unicode test
  cases.push({
    name: 'Unicode特殊字符',
    value: '测试😀🎉',
    expectedResult: 'valid', // Usually should be accepted
    description: '包含emoji等Unicode字符',
    category: 'special',
  });

  return cases;
}

/**
 * Analyze boundary coverage for test cases
 */
export function analyzeBoundaryCoverage(
  field: FieldDefinition,
  testCases: BoundaryTestCase[],
): {
  totalCases: number;
  validCases: number;
  invalidCases: number;
  categories: Record<string, number>;
} {
  const categories: Record<string, number> = {};

  for (const tc of testCases) {
    categories[tc.category] = (categories[tc.category] || 0) + 1;
  }

  return {
    totalCases: testCases.length,
    validCases: testCases.filter((tc) => tc.expectedResult === 'valid').length,
    invalidCases: testCases.filter((tc) => tc.expectedResult === 'invalid')
      .length,
    categories,
  };
}
