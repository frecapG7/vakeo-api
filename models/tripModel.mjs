import mongoose from "mongoose";


const tripSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxLength: 50,
    },
    users: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "TripUser",
    },
    image: {
        type: String,
        required: false,
    },
    startDate: {
        type: Date,
        required: false
    },
    endDate: {
        type: Date,
        required: false,
    }

}, { timestamps: true });


export default mongoose.model("Trip", tripSchema);