/**
 * Semantic Parser
 * Parses field labels and placeholders to determine semantic type
 */

import type {
  FieldConstraints,
  FieldType,
  SemanticType,
} from '../../types/dataGen';

/**
 * Keyword mapping for semantic type detection
 * Maps keywords (in Chinese and English) to semantic types
 */
const SEMANTIC_KEYWORDS: Record<SemanticType, string[]> = {
  username: [
    '用户名',
    '账号',
    '登录名',
    'username',
    'account',
    'login',
    'user id',
    'userid',
  ],
  realname: [
    '真实姓名',
    '姓名',
    '名字',
    'real name',
    'full name',
    'name',
    '本名',
  ],
  nickname: ['昵称', '别名', '显示名', 'nickname', 'display name', 'alias'],
  email: ['邮箱', '电子邮件', '电邮', 'email', 'e-mail', 'mail'],
  mobile_phone: [
    '手机',
    '手机号',
    '移动电话',
    'mobile',
    'phone',
    'cell',
    '电话号码',
    '联系电话',
  ],
  landline: ['座机', '固定电话', '固话', 'landline', 'tel', 'telephone'],
  password: [
    '密码',
    '口令',
    'password',
    'pwd',
    'pass',
    '登录密码',
    '新密码',
    '确认密码',
  ],
  captcha: [
    '验证码',
    '验证',
    'captcha',
    'verification',
    'code',
    'verify code',
    '图形验证码',
    '短信验证码',
  ],
  id_card: ['身份证', '身份证号', 'id card', 'id number', 'identity', '证件号'],
  bank_card: [
    '银行卡',
    '卡号',
    '银行卡号',
    'bank card',
    'card number',
    'debit card',
    'credit card',
  ],
  address: [
    '地址',
    '详细地址',
    '通讯地址',
    '收货地址',
    'address',
    'street',
    '街道',
  ],
  postal_code: ['邮编', '邮政编码', 'zip', 'postal', 'zip code', 'postcode'],
  city: ['城市', '所在城市', 'city', 'town'],
  province: ['省份', '省', 'province', 'state', '所在省份'],
  country: ['国家', '国籍', 'country', 'nation', 'nationality'],
  date_of_birth: [
    '出生日期',
    '生日',
    '出生年月',
    'birthday',
    'birth date',
    'dob',
    'date of birth',
  ],
  amount: [
    '金额',
    '价格',
    '费用',
    '总价',
    'amount',
    'price',
    'cost',
    'total',
    '付款金额',
  ],
  quantity: ['数量', '件数', '个数', 'quantity', 'qty', 'count', 'number'],
  description: [
    '描述',
    '备注',
    '说明',
    '详情',
    'description',
    'desc',
    'note',
    'remark',
    'comment',
  ],
  url: ['网址', '链接', 'url', 'link', 'website', 'homepage'],
  company: [
    '公司',
    '单位',
    '企业',
    'company',
    'organization',
    'corp',
    'enterprise',
    '工作单位',
  ],
  job_title: [
    '职位',
    '职称',
    '岗位',
    'job',
    'position',
    'title',
    'role',
    '职业',
  ],
  custom: [],
};

/**
 * Field type keyword mapping
 */
const FIELD_TYPE_KEYWORDS: Record<FieldType, string[]> = {
  text: ['text', '文本', 'input'],
  number: ['number', '数字', '数量', '金额', 'num', 'int', 'integer'],
  email: ['email', '邮箱', 'mail'],
  phone: ['phone', 'tel', '电话', '手机', 'mobile'],
  date: ['date', '日期', '生日', 'birthday'],
  datetime: ['datetime', '时间', 'time'],
  password: ['password', '密码', 'pwd'],
  select: ['select', '选择', '下拉', 'dropdown'],
  checkbox: ['checkbox', '复选', '多选'],
  radio: ['radio', '单选'],
  textarea: ['textarea', '多行', '描述', '备注', 'description'],
  file: ['file', '文件', '上传', 'upload', 'attachment'],
  url: ['url', '网址', 'link', '链接'],
};

/**
 * Priority order for semantic type detection
 * Higher priority types are checked first
 */
const SEMANTIC_PRIORITY: SemanticType[] = [
  'password',
  'captcha',
  'email',
  'mobile_phone',
  'id_card',
  'bank_card',
  'date_of_birth',
  'postal_code',
  'amount',
  'quantity',
  'url',
  'username',
  'realname',
  'nickname',
  'landline',
  'address',
  'city',
  'province',
  'country',
  'company',
  'job_title',
  'description',
  'custom',
];

/**
 * Normalize text for matching
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[_\-\s]+/g, ' ');
}

/**
 * Check if text contains any of the keywords
 */
function containsKeyword(text: string, keywords: string[]): boolean {
  const normalizedText = normalize(text);
  return keywords.some((keyword) =>
    normalizedText.includes(normalize(keyword)),
  );
}

/**
 * Calculate match score for a semantic type
 */
function calculateMatchScore(text: string, semanticType: SemanticType): number {
  const keywords = SEMANTIC_KEYWORDS[semanticType];
  if (!keywords || keywords.length === 0) return 0;

  const normalizedText = normalize(text);
  let score = 0;

  for (const keyword of keywords) {
    const normalizedKeyword = normalize(keyword);

    // Exact match gets highest score
    if (normalizedText === normalizedKeyword) {
      score += 100;
    }
    // Contains keyword
    else if (normalizedText.includes(normalizedKeyword)) {
      // Longer keyword matches are more specific
      score += 50 + normalizedKeyword.length;
    }
    // Keyword contains text
    else if (normalizedKeyword.includes(normalizedText)) {
      score += 30;
    }
  }

  return score;
}

/**
 * Parse semantic type from label text
 */
export function parseSemanticType(
  label: string,
  placeholder?: string,
): SemanticType {
  const combinedText = `${label} ${placeholder || ''}`;

  // Check each semantic type in priority order
  for (const semanticType of SEMANTIC_PRIORITY) {
    const keywords = SEMANTIC_KEYWORDS[semanticType];
    if (keywords && containsKeyword(combinedText, keywords)) {
      return semanticType;
    }
  }

  return 'custom';
}

/**
 * Parse semantic type with confidence score
 */
export function parseSemanticTypeWithConfidence(
  label: string,
  placeholder?: string,
): { type: SemanticType; confidence: number } {
  const combinedText = `${label} ${placeholder || ''}`;

  let bestType: SemanticType = 'custom';
  let bestScore = 0;

  for (const semanticType of SEMANTIC_PRIORITY) {
    const score = calculateMatchScore(combinedText, semanticType);
    if (score > bestScore) {
      bestScore = score;
      bestType = semanticType;
    }
  }

  // Normalize confidence to 0-100
  const confidence = Math.min(100, bestScore);

  return { type: bestType, confidence };
}

/**
 * Parse field type from HTML input type or label
 */
export function parseFieldType(
  htmlType?: string,
  label?: string,
  placeholder?: string,
): FieldType {
  // First check HTML type attribute
  if (htmlType) {
    const normalizedType = normalize(htmlType);
    if (normalizedType === 'email') return 'email';
    if (normalizedType === 'password') return 'password';
    if (normalizedType === 'number') return 'number';
    if (normalizedType === 'tel') return 'phone';
    if (normalizedType === 'date') return 'date';
    if (normalizedType === 'datetime-local' || normalizedType === 'datetime')
      return 'datetime';
    if (normalizedType === 'url') return 'url';
    if (normalizedType === 'file') return 'file';
    if (normalizedType === 'checkbox') return 'checkbox';
    if (normalizedType === 'radio') return 'radio';
  }

  // Then check label and placeholder
  const combinedText = `${label || ''} ${placeholder || ''}`;

  for (const [fieldType, keywords] of Object.entries(FIELD_TYPE_KEYWORDS)) {
    if (containsKeyword(combinedText, keywords)) {
      return fieldType as FieldType;
    }
  }

  return 'text';
}

/**
 * Extract constraints from HTML attributes and label
 */
export function extractConstraints(
  label: string,
  attributes?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  },
): FieldConstraints {
  const constraints: FieldConstraints = {
    required: attributes?.required ?? false,
  };

  // Check for required indicator in label
  if (/[*＊]|必填|required/i.test(label)) {
    constraints.required = true;
  }

  // Copy numeric constraints
  if (attributes?.minLength !== undefined) {
    constraints.minLength = attributes.minLength;
  }
  if (attributes?.maxLength !== undefined) {
    constraints.maxLength = attributes.maxLength;
  }
  if (attributes?.min !== undefined) {
    constraints.minValue = attributes.min;
  }
  if (attributes?.max !== undefined) {
    constraints.maxValue = attributes.max;
  }
  if (attributes?.pattern) {
    constraints.pattern = attributes.pattern;
  }

  return constraints;
}

/**
 * Get semantic keywords for a specific type or all types
 */
export function getSemanticKeywords(
  semanticType?: SemanticType,
): string[] | Record<SemanticType, string[]> {
  if (semanticType) {
    return SEMANTIC_KEYWORDS[semanticType]
      ? [...SEMANTIC_KEYWORDS[semanticType]]
      : [];
  }
  return { ...SEMANTIC_KEYWORDS };
}

/**
 * Add custom keywords for a semantic type
 */
export function addSemanticKeywords(
  semanticType: SemanticType,
  keywords: string[],
): void {
  if (!SEMANTIC_KEYWORDS[semanticType]) {
    SEMANTIC_KEYWORDS[semanticType] = [];
  }
  SEMANTIC_KEYWORDS[semanticType].push(...keywords);
}
