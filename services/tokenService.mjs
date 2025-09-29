import { jwtVerify, SignJWT } from "jose"
import config from "../config.mjs";

const secret = new TextEncoder().encode(config.token_secret);

export const generateJWT = async (id, expiresIn = "1h") => {
    try {
        const jwt = await new SignJWT({ sub: String(id) })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime(expiresIn)
            .sign(secret);

        return jwt;
    } catch (error) {
        console.error("Cannot generate JWT Token", error);
        throw error;
    }
}


export const verifyJWT = async (jwt) => {
    try {
        const { payload } = await jwtVerify(jwt, secret);
        return payload;
    } catch (error) {
        console.error("Cannot verify JWT", error);
        throw error;
    }
}