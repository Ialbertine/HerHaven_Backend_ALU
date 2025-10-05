const quickExitCheck = (req, res, next) => {
    // Check for quick exit trigger in headers or query params
    const quickExitTrigger = req.headers['x-quick-exit'] || req.query.quickExit;
    
    if (quickExitTrigger === 'true') {
        return res.redirect(process.env.QUICK_EXIT_REDIRECT_URL || 'https://google.com');
    }
    
    next();
};

const securityHeaders = (req, res, next) => {
    // Security headers for enhanced privacy and safety
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer');
    
    next();
};

module.exports = { quickExitCheck, securityHeaders };