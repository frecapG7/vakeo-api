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
    },
    voters: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "TripUser",
        validate: {
            validator: (v) => v?.length > 0,
            message: "A votes requires a least one voter"
        },
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


