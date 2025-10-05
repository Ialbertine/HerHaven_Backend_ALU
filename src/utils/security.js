const crypto = require('crypto');

class SecurityUtils {
    static generateGuestSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }

    static sanitizeUserInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/[<>]/g, '')
            .trim()
            .substring(0, 500); // Limit input length
    }

    static isStrongPassword(password) {
        const minLength = 6;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        
        return password.length >= minLength && hasLowerCase && hasUpperCase && hasNumbers;
    }

    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

module.exports = SecurityUtils;