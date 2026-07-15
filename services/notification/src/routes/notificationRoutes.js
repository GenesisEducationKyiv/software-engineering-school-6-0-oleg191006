const { Router } = require('express');
const emailService = require('../services/emailService');
const logger = require('../logger');

const router = Router();

router.post('/confirmation', async (req, res) => {
    try {
        const { to, repo, confirmUrl, unsubscribeToken } = req.body;

        if (!to || !repo || !confirmUrl) {
            return res.status(400).json({ error: 'Missing required fields: to, repo, confirmUrl' });
        }

        await emailService.sendConfirmation({ to, repo, confirmUrl, unsubscribeToken });
        return res.status(200).json({ success: true });
    } catch (err) {
        logger.error('Failed to send confirmation email', err);
        return res.status(500).json({ error: 'Failed to send confirmation email' });
    }
});

router.post('/release', async (req, res) => {
    try {
        const { to, repo, release, unsubscribeUrl } = req.body;

        if (!to || !repo || !release) {
            return res.status(400).json({ error: 'Missing required fields: to, repo, release' });
        }

        await emailService.sendRelease({ to, repo, release, unsubscribeUrl });
        return res.status(200).json({ success: true });
    } catch (err) {
        logger.error('Failed to send release notification', err);
        return res.status(500).json({ error: 'Failed to send release notification' });
    }
});

module.exports = router;
