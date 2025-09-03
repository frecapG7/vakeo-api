import mongoose from "mongoose";



/**
 * TripUser schema
 * User naming must stay reserved for UserAccount one day
 */
const tripUserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxLength: 50
    },
    avatar: {
        type: String,
    }
});



export default mongoose.model("TripUser", tripUserSchema);