import mongoose from "mongoose";

const voteSchema = new mongoose.Schema({
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
        required: true
    },
    status: {
        type: String,
        required: true,
        default: "OPEN",
        enum: ["OPEN", "CLOSED"]
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser",
        required: true
    }
}, {
    discriminatorKey: "type",
    timestamps: true
});



export const Vote = mongoose.model("Vote", voteSchema);

export const DatesVote = Vote.discriminator("DATES", new mongoose.Schema(
    {
        votes: {
            type: [
                {
                    startDate: {
                        type: Date,
                        required: true,
                    },
                    endDate: {
                        type: Date,
                        required: true,
                    },
                    users: {
                        type: [mongoose.Schema.Types.ObjectId],
                        ref: "User",
                        required: true
                    }
                }]
        }
    }
));


