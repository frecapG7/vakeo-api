


export class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotFoundError";
        this.statusCode = 404;
    }
}


export class InvalidError extends Error {
    constructor(message){
        super(message);
        this.name = "InvalidError";
        this.statusCode = 422
    }
}