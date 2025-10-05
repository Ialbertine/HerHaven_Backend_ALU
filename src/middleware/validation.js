const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.details.map(detail => detail.message)
            });
        }
        
        next();
    };
};

module.exports = validate;