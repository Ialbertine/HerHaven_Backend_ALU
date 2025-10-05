const logger = require('../utils/logger');

const safetyController = {
    // Quick exit endpoint - immediately redirects to safe site
    quickExit: (req, res) => {
        try {
            logger.info('Quick exit triggered', {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Redirect to safe website (Google by default)
            const redirectUrl = process.env.QUICK_EXIT_REDIRECT_URL || 'https://google.com';
            
            res.redirect(redirectUrl);

        } catch (error) {
            logger.error('Quick exit error:', error);
            // Even if error occurs, still try to redirect
            res.redirect('https://google.com');
        }
    },

    // Safety check endpoint - returns safety information
    safetyCheck: (req, res) => {
        try {
            const safetyInfo = {
                quickExitUrl: `${req.protocol}://${req.get('host')}/api/safety/quick-exit`,
                emergencyHotlines: [
                    {
                        name: 'Isange One Stop Center',
                        number: '116',
                        description: 'Free national helpline for GBV victims'
                    },
                    {
                        name: 'Rwanda National Police',
                        number: '112',
                        description: 'Emergency services'
                    }
                ],
                safetyTips: [
                    'Use incognito/private browsing mode',
                    'Clear your browser history regularly',
                    'Use the quick exit button if you feel unsafe',
                    'Create a safe word with trusted friends/family'
                ]
            };

            res.json({
                success: true,
                message: 'Safety information retrieved',
                data: safetyInfo
            });

        } catch (error) {
            logger.error('Safety check error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve safety information'
            });
        }
    }
};

module.exports = safetyController;