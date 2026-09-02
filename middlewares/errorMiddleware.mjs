

export const handleError = (err, req, res, next) => {
    const status = err.statusCode || 500;
    const isOperational = Boolean(err.statusCode);

    if (!isOperational) {
        console.error("[unhandled]", {
            method: req.method,
            url: req.originalUrl,
            message: err.message,
            stack: err.stack,
        });
    }

    res.status(status).json({
        message: isOperational ? err.message : "Internal server error",
    });
}



