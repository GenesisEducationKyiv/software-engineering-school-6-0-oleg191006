const buildConfig = (overrides = {}) => ({
    appUrl: 'http://localhost:3000',
    smtp: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        requireTLS: true,
        rejectUnauthorized: true,
        connectionTimeoutMs: 1000,
        greetingTimeoutMs: 1000,
        socketTimeoutMs: 1000,
        user: 'user',
        pass: 'pass',
        from: 'GitHub Notificator <noreply@notificator.app>',
    },
    resend: {
        apiKey: '',
        from: 'Notificator <onboarding@resend.dev>',
        timeoutMs: 1000,
    },
    ...overrides,
});

const loadService = (configOverrides = {}) => {
    jest.resetModules();

    const config = buildConfig(configOverrides);

    jest.doMock('@/config', () => config);
    jest.doMock('@/utils/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    }));
    jest.doMock('axios', () => ({
        post: jest.fn(),
    }));
    jest.doMock('nodemailer', () => ({
        createTransport: jest.fn(),
    }));

    const service = require('@/services/emailService');
    const logger = require('@/utils/logger');
    const axios = require('axios');
    const nodemailer = require('nodemailer');

    return {
        service,
        logger,
        config,
        axios,
        nodemailer,
    };
};

describe('emailService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should send confirmation via SMTP when Resend is disabled', async () => {
        const { service, logger, axios } = loadService({
            resend: { apiKey: '', from: 'Resend <resend@example.com>', timeoutMs: 1000 },
        });

        const transport = { sendMail: jest.fn().mockResolvedValue(true) };
        service.setTransporter(transport);

        await service.sendConfirmationEmail('user@example.com', 'nodejs/node', 'confirm', 'unsubscribe');

        expect(transport.sendMail).toHaveBeenCalledTimes(1);
        expect(axios.post).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalled();
    });

    it('should send confirmation via Resend when configured', async () => {
        const { service, logger, config, axios } = loadService({
            resend: { apiKey: 'resend-key', from: 'Resend <resend@example.com>', timeoutMs: 1000 },
        });

        const transport = { sendMail: jest.fn().mockResolvedValue(true) };
        service.setTransporter(transport);
        axios.post.mockResolvedValue({ status: 200 });

        await service.sendConfirmationEmail('user@example.com', 'nodejs/node', 'confirm', 'unsubscribe');

        expect(axios.post).toHaveBeenCalledWith(
            'https://api.resend.com/emails',
            expect.objectContaining({
                from: config.resend.from,
                to: ['user@example.com'],
                subject: expect.stringContaining('nodejs/node'),
                html: expect.stringContaining('/api/confirm/confirm'),
            }),
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer resend-key' }),
                timeout: config.resend.timeoutMs,
            }),
        );
        expect(transport.sendMail).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalled();
    });

    it('should fall back to SMTP when Resend fails', async () => {
        const { service, logger, axios } = loadService({
            resend: { apiKey: 'resend-key', from: 'Resend <resend@example.com>', timeoutMs: 1000 },
        });

        const transport = { sendMail: jest.fn().mockResolvedValue(true) };
        service.setTransporter(transport);
        axios.post.mockRejectedValue(new Error('resend failed'));

        await service.sendConfirmationEmail('user@example.com', 'nodejs/node', 'confirm', 'unsubscribe');

        expect(transport.sendMail).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalled();
    });

    it('should throw when SMTP send fails for confirmation email', async () => {
        const { service, logger } = loadService();

        const transport = { sendMail: jest.fn().mockRejectedValue(new Error('smtp down')) };
        service.setTransporter(transport);

        await expect(
            service.sendConfirmationEmail('user@example.com', 'nodejs/node', 'confirm', 'unsubscribe'),
        ).rejects.toThrow('smtp down');

        expect(logger.error).toHaveBeenCalled();
    });

    it('should swallow errors when sending release notifications', async () => {
        const { service, logger } = loadService();

        const transport = { sendMail: jest.fn().mockRejectedValue(new Error('smtp down')) };
        service.setTransporter(transport);

        await expect(
            service.sendReleaseNotification('user@example.com', 'nodejs/node', {
                tag: 'v1.0.0',
                name: 'Release 1',
                url: 'https://github.com/nodejs/node/releases/tag/v1.0.0',
                publishedAt: '2024-01-01',
            }, 'unsubscribe'),
        ).resolves.toBeUndefined();

        expect(logger.error).toHaveBeenCalled();
    });

    it('should create SMTP transporter when needed', async () => {
        const { service, config, nodemailer } = loadService();

        const sendMail = jest.fn().mockResolvedValue(true);
        nodemailer.createTransport.mockReturnValue({ sendMail });

        await service.sendReleaseNotification('user@example.com', 'nodejs/node', {
            tag: 'v1.0.0',
            name: 'Release 1',
            url: 'https://github.com/nodejs/node/releases/tag/v1.0.0',
            publishedAt: '2024-01-01',
        }, 'unsubscribe');

        expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: expect.objectContaining({ user: config.smtp.user, pass: config.smtp.pass }),
        }));
        expect(sendMail).toHaveBeenCalled();
    });
});
