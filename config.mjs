import dotenv from "dotenv";
dotenv.config();


export default {
    port: process.env.PORT || 3000,
    environment: process.env.ENVIRONMENT || 'development',

    api_key: process.env.API_KEY,



    db: {
        user: process.env.MONGODB_USER,
        password: process.env.MONGODB_PASSWORD,
        cluster: process.env.MONGODB_CLUSTER,
        dbName: process.env.MONGODB_DBNAME || "test",
        options: process.env.MONGODB_OPTIONS,
        debug: process.env.MONGODB_DEBUG || false
    }


}