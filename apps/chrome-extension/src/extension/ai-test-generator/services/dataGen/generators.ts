/**
 * Built-in Data Generators
 * Provides data generation functions for different semantic types
 */

import type { SemanticType, FieldConstraints } from '../../types/dataGen';

/**
 * Generator function type
 */
export type GeneratorFn = (constraints?: FieldConstraints, locale?: string) => unknown;

/**
 * Random utilities
 */
const random = {
  int: (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min,

  pick: <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)],

  string: (length: number, chars = 'abcdefghijklmnopqrstuvwxyz0123456789'): string =>
    Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),

  digits: (length: number): string =>
    Array.from({ length }, () => Math.floor(Math.random() * 10)).join(''),
};

/**
 * Chinese name data pools
 */
const CN_SURNAMES = ['张', '王', '李', '赵', '陈', '刘', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡'];
const CN_GIVEN_NAMES = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明'];

/**
 * Chinese mobile prefixes (valid carriers)
 */
const CN_MOBILE_PREFIXES = [
  '130', '131', '132', '133', '134', '135', '136', '137', '138', '139',
  '150', '151', '152', '153', '155', '156', '157', '158', '159',
  '170', '171', '172', '173', '175', '176', '177', '178',
  '180', '181', '182', '183', '184', '185', '186', '187', '188', '189',
  '191', '193', '195', '196', '197', '198', '199',
];

/**
 * Chinese provinces for ID card
 */
const CN_PROVINCES: Record<string, string> = {
  '11': '北京', '12': '天津', '13': '河北', '14': '山西', '15': '内蒙古',
  '21': '辽宁', '22': '吉林', '23': '黑龙江',
  '31': '上海', '32': '江苏', '33': '浙江', '34': '安徽', '35': '福建', '36': '江西', '37': '山东',
  '41': '河南', '42': '湖北', '43': '湖南', '44': '广东', '45': '广西', '46': '海南',
  '50': '重庆', '51': '四川', '52': '贵州', '53': '云南', '54': '西藏',
  '61': '陕西', '62': '甘肃', '63': '青海', '64': '宁夏', '65': '新疆',
};

/**
 * Email domains
 */
const EMAIL_DOMAINS = ['gmail.com', 'qq.com', '163.com', 'outlook.com', 'hotmail.com', 'example.com'];

/**
 * Chinese cities
 */
const CN_CITIES = ['北京市', '上海市', '广州市', '深圳市', '杭州市', '成都市', '武汉市', '南京市', '西安市', '重庆市'];

/**
 * Chinese addresses
 */
const CN_DISTRICTS = ['朝阳区', '海淀区', '浦东新区', '南山区', '天河区', '福田区', '余杭区', '锦江区'];
const CN_STREETS = ['建国路', '中关村大街', '南京路', '深南大道', '天府大道', '解放路', '人民路', '长安街'];

/**
 * Generate Chinese mobile phone number
 */
export function generateMobilePhone(): string {
  const prefix = random.pick(CN_MOBILE_PREFIXES);
  const suffix = random.digits(8);
  return prefix + suffix;
}

/**
 * Generate email address
 */
export function generateEmail(constraints?: FieldConstraints): string {
  const localPart = random.string(random.int(6, 12));
  const domain = constraints?.options?.[0] || random.pick(EMAIL_DOMAINS);
  return `${localPart}@${domain}`;
}

/**
 * Generate Chinese real name
 */
export function generateRealName(): string {
  const surname = random.pick(CN_SURNAMES);
  const givenName = random.pick(CN_GIVEN_NAMES) + (Math.random() > 0.5 ? random.pick(CN_GIVEN_NAMES) : '');
  return surname + givenName;
}

/**
 * Generate username
 */
export function generateUsername(constraints?: FieldConstraints): string {
  const minLen = constraints?.minLength || 6;
  const maxLen = constraints?.maxLength || 16;
  const length = random.int(minLen, maxLen);
  return random.string(length, 'abcdefghijklmnopqrstuvwxyz0123456789_');
}

/**
 * Generate nickname
 */
export function generateNickname(): string {
  const prefixes = ['快乐', '阳光', '微笑', '幸福', '可爱', '温暖', '自由', '梦想'];
  const suffixes = ['小王子', '小公主', '达人', '少年', '青年', '宝贝', '天使', '精灵'];
  return random.pick(prefixes) + random.pick(suffixes);
}

/**
 * Generate password (for test purposes)
 */
export function generatePassword(constraints?: FieldConstraints): string {
  const minLen = constraints?.minLength || 8;
  const maxLen = constraints?.maxLength || 16;
  const length = random.int(minLen, maxLen);

  // Ensure password contains required character types
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '@#$%&*!';

  // Start with one of each required type
  let password = random.pick([...upper]) + random.pick([...lower]) + random.pick([...digits]) + random.pick([...special]);

  // Fill the rest
  const allChars = upper + lower + digits + special;
  password += random.string(length - 4, allChars);

  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Calculate ID card checksum digit
 */
function calculateIdCardChecksum(id17: string): string {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checksumChars = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(id17[i], 10) * weights[i];
  }

  return checksumChars[sum % 11];
}

/**
 * Generate Chinese ID card number (18 digits)
 */
export function generateIdCard(): string {
  // Province code (first 2 digits)
  const provinceCode = random.pick(Object.keys(CN_PROVINCES));

  // City code (3-4 digits)
  const cityCode = random.digits(2);

  // District code (5-6 digits)
  const districtCode = random.digits(2);

  // Birth date (7-14 digits, YYYYMMDD format)
  const year = random.int(1960, 2005);
  const month = random.int(1, 12).toString().padStart(2, '0');
  const day = random.int(1, 28).toString().padStart(2, '0');
  const birthDate = `${year}${month}${day}`;

  // Sequential code (15-17 digits)
  const seqCode = random.digits(3);

  // Build first 17 digits
  const id17 = provinceCode + cityCode + districtCode + birthDate + seqCode;

  // Calculate checksum
  const checksum = calculateIdCardChecksum(id17);

  return id17 + checksum;
}

/**
 * Generate bank card number (16-19 digits)
 * Note: This generates test-only card numbers with valid Luhn checksum
 */
export function generateBankCard(): string {
  // Common Chinese bank BINs (first 6 digits)
  const bankBins = [
    '621700', // ICBC
    '622202', // ICBC
    '621661', // ABC
    '622848', // BOC
    '622588', // CCB
    '621285', // CMB
  ];

  const bin = random.pick(bankBins);
  const accountLength = random.pick([10, 11, 12, 13]); // Total 16-19 digits
  let account = bin + random.digits(accountLength - 1);

  // Calculate Luhn checksum
  let sum = 0;
  let isEven = false;
  for (let i = account.length - 1; i >= 0; i--) {
    let digit = parseInt(account[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return account + checkDigit;
}

/**
 * Generate postal code (Chinese format: 6 digits)
 */
export function generatePostalCode(): string {
  // First digit 1-8, followed by 5 digits
  return random.int(1, 8).toString() + random.digits(5);
}

/**
 * Generate Chinese address
 */
export function generateAddress(): string {
  const city = random.pick(CN_CITIES);
  const district = random.pick(CN_DISTRICTS);
  const street = random.pick(CN_STREETS);
  const number = random.int(1, 999);
  const building = random.int(1, 30);
  const room = random.int(101, 2501);

  return `${city}${district}${street}${number}号${building}栋${room}室`;
}

/**
 * Generate city name
 */
export function generateCity(): string {
  return random.pick(CN_CITIES);
}

/**
 * Generate province name
 */
export function generateProvince(): string {
  return random.pick(Object.values(CN_PROVINCES));
}

/**
 * Generate date of birth (YYYY-MM-DD format)
 */
export function generateDateOfBirth(): string {
  const year = random.int(1960, 2005);
  const month = random.int(1, 12).toString().padStart(2, '0');
  const day = random.int(1, 28).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate amount (with 2 decimal places)
 */
export function generateAmount(constraints?: FieldConstraints): number {
  const min = constraints?.minValue ?? 0.01;
  const max = constraints?.maxValue ?? 10000;
  const amount = Math.random() * (max - min) + min;
  return Math.round(amount * 100) / 100;
}

/**
 * Generate quantity (integer)
 */
export function generateQuantity(constraints?: FieldConstraints): number {
  const min = constraints?.minValue ?? 1;
  const max = constraints?.maxValue ?? 100;
  return random.int(min, max);
}

/**
 * Generate description text
 */
export function generateDescription(constraints?: FieldConstraints): string {
  const phrases = [
    '这是一个测试描述',
    '用于自动化测试的示例文本',
    '测试数据生成器创建的内容',
    '这段文字用于测试表单输入',
    '自动生成的测试描述信息',
  ];

  let text = random.pick(phrases);

  // Adjust length if constraints exist
  if (constraints?.minLength && text.length < constraints.minLength) {
    while (text.length < constraints.minLength) {
      text += '。' + random.pick(phrases);
    }
  }

  if (constraints?.maxLength && text.length > constraints.maxLength) {
    text = text.slice(0, constraints.maxLength);
  }

  return text;
}

/**
 * Generate URL
 */
export function generateUrl(): string {
  const protocols = ['https://'];
  const domains = ['example.com', 'test.com', 'demo.org', 'sample.net'];
  const paths = ['', '/page', '/test', '/demo', '/api/v1'];

  return random.pick(protocols) + random.pick(domains) + random.pick(paths);
}

/**
 * Generate company name
 */
export function generateCompany(): string {
  const prefixes = ['北京', '上海', '深圳', '杭州', '广州'];
  const middles = ['科技', '信息', '网络', '数据', '智能'];
  const suffixes = ['有限公司', '股份有限公司', '集团有限公司'];

  return random.pick(prefixes) + random.string(2, '华盛达联创新') + random.pick(middles) + random.pick(suffixes);
}

/**
 * Generate job title
 */
export function generateJobTitle(): string {
  const titles = [
    '软件工程师', '产品经理', '设计师', '测试工程师', '项目经理',
    '前端开发工程师', '后端开发工程师', '运维工程师', '数据分析师', '架构师',
  ];
  return random.pick(titles);
}

/**
 * Generate captcha (4-6 digit/letter combination)
 */
export function generateCaptcha(constraints?: FieldConstraints): string {
  const length = constraints?.maxLength || 6;
  return random.string(length, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
}

/**
 * Generate landline phone number
 */
export function generateLandline(): string {
  const areaCodes = ['010', '021', '020', '0755', '0571', '028'];
  const areaCode = random.pick(areaCodes);
  const digits = areaCode.length === 3 ? 8 : 7;
  return areaCode + '-' + random.digits(digits);
}

/**
 * Generator registry - maps semantic types to generators
 */
export const generators: Record<SemanticType, GeneratorFn> = {
  username: generateUsername,
  realname: generateRealName,
  nickname: generateNickname,
  email: generateEmail,
  mobile_phone: generateMobilePhone,
  landline: generateLandline,
  password: generatePassword,
  captcha: generateCaptcha,
  id_card: generateIdCard,
  bank_card: generateBankCard,
  address: generateAddress,
  postal_code: generatePostalCode,
  city: generateCity,
  province: generateProvince,
  country: () => '中国',
  date_of_birth: generateDateOfBirth,
  amount: generateAmount,
  quantity: generateQuantity,
  description: generateDescription,
  url: generateUrl,
  company: generateCompany,
  job_title: generateJobTitle,
  custom: (constraints) => constraints?.options?.[0] ?? 'custom_value',
};

/**
 * Generate data for a semantic type
 */
export function generateForSemanticType(
  semanticType: SemanticType,
  constraints?: FieldConstraints,
  locale?: string
): unknown {
  const generator = generators[semanticType];
  if (!generator) {
    throw new Error(`No generator found for semantic type: ${semanticType}`);
  }
  return generator(constraints, locale);
}
