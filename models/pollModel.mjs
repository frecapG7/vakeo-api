import mongoose from "mongoose";


const pollSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
        required: true,
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser",
        required: true
    },
    isSingleAnswer: {
        type: Boolean,
        default: false
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    isClosed: {
        type: Boolean,
        default: false
    },
    hasSelected: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser"
    }]
},
    {
        discriminatorKey: "type",
        timestamps: true
    }
);



pollSchema.pre("save", async function (next) {
    const allSelectedUsers = this.options.flatMap(
        option => option.selectedBy
    );
    this.hasSelected = [...new Set(allSelectedUsers)];
    next();
});
export const Poll = mongoose.model("Poll", pollSchema);

export const DatesPoll = Poll.discriminator("DatesPoll", new mongoose.Schema({
    options: {
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
                selectedBy: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "TripUser"
                }]
            }
        ]
    }
}));



export const HousingPoll = Poll.discriminator("HousingPoll", new mongoose.Schema({
    options: {
        type: [
            {
                title: {
                    type: String,
                    required: true
                },
                value: {
                    type: String,
                    required: true
                },
                selectedBy: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "TripUser"
                }]
            }
        ]
    }
}));



export const OtherPoll = Poll.discriminator("OtherPoll", new mongoose.Schema({
    options: {
        type: [
            {
                value: {
                    type: String,
                    required: true
                },
                selectedBy: [{
                    type: mongoose.Schema.Types.ObjectId
                }]
            }
        ]
    }
}))



