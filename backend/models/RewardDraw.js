const mongoose = require("mongoose");

const rewardDrawSchema = new mongoose.Schema(
    {
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true
        },

        title: {
            type: String,
            required: true
        },

        description: {
            type: String
        },

        drawDate: {
            type: Date,
            required: true
        },

        winners: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },

                prize: {
                    type: String,
                    required: true
                }
            }
        ],

        status: {
            type: String,
            enum: ["scheduled", "completed", "cancelled"],
            default: "scheduled"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("RewardDraw", rewardDrawSchema);