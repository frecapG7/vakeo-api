import mongoose from "mongoose";
import config from "../config.mjs";




mongoose.set("debug", false);

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});



const connect = async () => {
 try {
    const uri = `mongodb+srv://${config.db.user}:${config.db.password}@${config.db.cluster}?${config.db.options}`
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1); // Arrête l’application en cas d’échec de connexion
  }
}

export default connect;