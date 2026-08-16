const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        paymentMethod: {
            type: String,
            enum: ["card", "upi", "netbanking", "wallet"],
            required: true
        },

        transactionId: {
            type: String,
            unique: true,
            required: true
        },

        status: {
            type: String,
            enum: ["pending", "success", "failed", "refunded"],
            default: "pending"
        },

        paidAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Payment", paymentSchema);