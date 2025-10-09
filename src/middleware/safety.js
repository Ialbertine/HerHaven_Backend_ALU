const quickExitCheck = (req, res, next) => {
    const quickExitTrigger = req.headers['x-quick-exit'] || req.query.quickExit;
    
    if (quickExitTrigger === 'true') {
        return res.redirect(process.env.QUICK_EXIT_REDIRECT_URL || 'https://google.com');
    }
    
    next();
};

const securityHeaders = (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    
    next();
};

module.exports = { quickExitCheck, securityHeaders };