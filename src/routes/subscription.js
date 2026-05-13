const { Router } = require('express');
const subscriptionService = require('@/services/subscriptionService');

const router = Router();

function asyncHandler(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}

router.post('/subscribe', asyncHandler(async (req, res) => {
    const { email, repo } = req.body;
    const result = await subscriptionService.subscribe(email, repo);
    return res.status(200).json(result);
}));

router.get('/confirm/:token', asyncHandler(async (req, res) => {
    const result = await subscriptionService.confirmSubscription(req.params.token);
    return res.status(200).json(result);
}));

router.get('/unsubscribe/:token', asyncHandler(async (req, res) => {
    const result = await subscriptionService.unsubscribe(req.params.token);
    return res.status(200).json(result);
}));

router.get('/subscriptions', asyncHandler(async (req, res) => {
    const result = await subscriptionService.getSubscriptions(req.query.email);
    return res.status(200).json(result);
}));

module.exports = router;