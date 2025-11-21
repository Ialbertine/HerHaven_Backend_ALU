const SecurityUtils = require('../../src/utils/security');

describe('SecurityUtils', () => {
  describe('generateGuestSessionId', () => {
    test('should generate a unique session ID', () => {
      const id1 = SecurityUtils.generateGuestSessionId();
      const id2 = SecurityUtils.generateGuestSessionId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBe(64); 
    });
  });

  describe('sanitizeUserInput', () => {
    test('should remove HTML tags from input', () => {
      const input = '<script>alert("xss")</script>hello';
      const result = SecurityUtils.sanitizeUserInput(input);

      expect(result).toBe('scriptalert("xss")/scripthello');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    test('should trim whitespace', () => {
      const input = '  hello world  ';
      const result = SecurityUtils.sanitizeUserInput(input);

      expect(result).toBe('hello world');
    });

    test('should limit input length to 500 characters', () => {
      const longInput = 'a'.repeat(600);
      const result = SecurityUtils.sanitizeUserInput(longInput);

      expect(result.length).toBe(500);
    });

    test('should return non-string input as-is', () => {
      expect(SecurityUtils.sanitizeUserInput(123)).toBe(123);
      expect(SecurityUtils.sanitizeUserInput(null)).toBe(null);
      expect(SecurityUtils.sanitizeUserInput(undefined)).toBe(undefined);
    });

    test('should handle empty string', () => {
      const result = SecurityUtils.sanitizeUserInput('');
      expect(result).toBe('');
    });
  });

  describe('isStrongPassword', () => {
    test('should return true for strong password', () => {
      expect(SecurityUtils.isStrongPassword('Test123')).toBe(true);
      expect(SecurityUtils.isStrongPassword('MyPass123')).toBe(true);
      expect(SecurityUtils.isStrongPassword('StrongP@ss1')).toBe(true);
    });

    test('should return false for password without uppercase', () => {
      expect(SecurityUtils.isStrongPassword('test123')).toBe(false);
    });

    test('should return false for password without lowercase', () => {
      expect(SecurityUtils.isStrongPassword('TEST123')).toBe(false);
    });

    test('should return false for password without numbers', () => {
      expect(SecurityUtils.isStrongPassword('TestPass')).toBe(false);
    });

    test('should return false for password shorter than 6 characters', () => {
      expect(SecurityUtils.isStrongPassword('Test1')).toBe(false);
      expect(SecurityUtils.isStrongPassword('T1')).toBe(false);
    });

    test('should return false for empty password', () => {
      expect(SecurityUtils.isStrongPassword('')).toBe(false);
    });
  });

  describe('validateEmail', () => {
    test('should return true for valid email addresses', () => {
      expect(SecurityUtils.validateEmail('test@example.com')).toBe(true);
      expect(SecurityUtils.validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(SecurityUtils.validateEmail('user+tag@example.com')).toBe(true);
    });

    test('should return false for invalid email addresses', () => {
      expect(SecurityUtils.validateEmail('invalid-email')).toBe(false);
      expect(SecurityUtils.validateEmail('@example.com')).toBe(false);
      expect(SecurityUtils.validateEmail('test@')).toBe(false);
      expect(SecurityUtils.validateEmail('test@.com')).toBe(false);
      expect(SecurityUtils.validateEmail('')).toBe(false);
      expect(SecurityUtils.validateEmail('test space@example.com')).toBe(false);
    });
  });
});

