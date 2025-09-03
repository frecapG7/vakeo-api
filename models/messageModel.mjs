import mongoose from "mongoose";


const modelSchema = new mongoose.Schema({
    text: {
        type: String,
        maxLength: 500,
        required: true
    },
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
        required: true
    },
    user :{
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser",
        required: true
    }
}, {
    timestamps: true
});



export default new mongoose.model("Message", modelSchema);
