import dotenv from "dotenv";
dotenv.config();


export default {
    port: process.env.PORT || 3000,
    environment: process.env.ENVIRONMENT || 'development',

    api_key: process.env.API_KEY
}