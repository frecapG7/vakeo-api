

export const handleError = (err, req, res, next) => {
    console.error("Toto: ", err);
    if (err.statusCode) {
        res.status(err.statusCode).send({ message: err.message });
    } else {
        res.status(500).json({ message: "Internal server error" });
    }
}



