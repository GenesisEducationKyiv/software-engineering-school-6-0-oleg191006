const { validateEmail, validateRepo, validateToken } = require('@/validators/subscription');

describe('validateEmail', () => {
    it('should return valid for correct email', () => {
        expect(validateEmail('user@example.com')).toEqual({ valid: true });
    });

    it('should return valid for email with subdomain', () => {
        expect(validateEmail('user@mail.example.com')).toEqual({ valid: true });
    });

    it('should return invalid for empty string', () => {
        const result = validateEmail('');
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it('should return invalid for null', () => {
        const result = validateEmail(null);
        expect(result.valid).toBe(false);
    });

    it('should return invalid for undefined', () => {
        const result = validateEmail(undefined);
        expect(result.valid).toBe(false);
    });

    it('should return invalid for non-string', () => {
        const result = validateEmail(123);
        expect(result.valid).toBe(false);
    });

    it('should return invalid for email without @', () => {
        const result = validateEmail('userexample.com');
        expect(result.valid).toBe(false);
    });

    it('should return invalid for email without domain', () => {
        const result = validateEmail('user@');
        expect(result.valid).toBe(false);
    });

    it('should return invalid for email with spaces', () => {
        const result = validateEmail('user @example.com');
        expect(result.valid).toBe(false);
    });
});

describe('validateRepo', () => {
    it('should return valid for correct owner/repo format', () => {
        expect(validateRepo('facebook/react')).toEqual({ valid: true });
    });

    it('should return valid for repo with dots and hyphens', () => {
        expect(validateRepo('my-org/my-repo.js')).toEqual({ valid: true });
    });

    it('should return valid for repo with underscores', () => {
        expect(validateRepo('owner_name/repo_name')).toEqual({ valid: true });
    });

    it('should return invalid for empty string', () => {
        const result = validateRepo('');
        expect(result.valid).toBe(false);
    });

    it('should return invalid for null', () => {
        const result = validateRepo(null);
        expect(result.valid).toBe(false);
    });

    it('should return invalid for repo without slash', () => {
        const result = validateRepo('facebookreact');
        expect(result.valid).toBe(false);
    });

    it('should return invalid for repo with multiple slashes', () => {
        const result = validateRepo('owner/repo/extra');
        expect(result.valid).toBe(false);
    });

    it('should return invalid for repo with spaces', () => {
        const result = validateRepo('owner /repo');
        expect(result.valid).toBe(false);
    });

    it('should return invalid for non-string', () => {
        const result = validateRepo(42);
        expect(result.valid).toBe(false);
    });
});

describe('validateToken', () => {
    it('should return valid for a non-empty string', () => {
        expect(validateToken('abc-123-def')).toEqual({ valid: true });
    });

    it('should return invalid for empty string', () => {
        const result = validateToken('');
        expect(result.valid).toBe(false);
    });

    it('should return invalid for null', () => {
        const result = validateToken(null);
        expect(result.valid).toBe(false);
    });

    it('should return invalid for whitespace only', () => {
        const result = validateToken('   ');
        expect(result.valid).toBe(false);
    });
});
