

export const handleError = (err, req, res, next) => {
    if (err.statusCode) {
        res.status(err.statusCode).json({ message: err.message });
    } else {
        res.status(500).json({ message: "Internal server error" });
    }
}



