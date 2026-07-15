const { validateEmail, validateRepo, validateToken } = require('@/modules/subscription/subscriptionValidator');

describe('validateEmail', () => {
    it('should return valid for proper email', () => {
        expect(validateEmail('user@example.com')).toEqual({ valid: true });
    });

    it('should return invalid for empty email', () => {
        expect(validateEmail('')).toMatchObject({ valid: false });
    });

    it('should return invalid for null email', () => {
        expect(validateEmail(null)).toMatchObject({ valid: false });
    });

    it('should return invalid for malformed email', () => {
        expect(validateEmail('not-an-email')).toMatchObject({ valid: false });
    });
});

describe('validateRepo', () => {
    it('should return valid for owner/repo format', () => {
        expect(validateRepo('facebook/react')).toEqual({ valid: true });
    });

    it('should return invalid for empty repo', () => {
        expect(validateRepo('')).toMatchObject({ valid: false });
    });

    it('should return invalid for missing slash', () => {
        expect(validateRepo('noslash')).toMatchObject({ valid: false });
    });
});

describe('validateToken', () => {
    it('should return valid for non-empty token', () => {
        expect(validateToken('abc-123')).toEqual({ valid: true });
    });

    it('should return invalid for empty token', () => {
        expect(validateToken('')).toMatchObject({ valid: false });
    });

    it('should return invalid for whitespace-only token', () => {
        expect(validateToken('   ')).toMatchObject({ valid: false });
    });
});
