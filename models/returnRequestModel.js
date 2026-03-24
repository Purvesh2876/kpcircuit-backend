const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
    },
    { _id: false }
);

const returnStatusHistorySchema = new mongoose.Schema(
    {
        status: {
            type: String,
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        updatedBy: {
            type: String, // 'user' or admin's email
        },
    },
    { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        items: [returnItemSchema],
        type: {
            type: String,
            enum: ["REFUND", "REPLACEMENT"],
            required: true,
        },
        reason: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["REQUESTED", "APPROVED", "REJECTED", "PICKED", "RECEIVED", "COMPLETED"],
            default: "REQUESTED",
            index: true,
        },
        refundStatus: {
            type: String,
            enum: ["PENDING", "PROCESSED", "FAILED"],
        },
        replacementOrder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
        },
        statusHistory: [returnStatusHistorySchema],
    },
    { timestamps: true }
);

// Prevent duplicate return requests for the same item in the same order
returnRequestSchema.index({ order: 1, "items.product": 1 }, { unique: true, sparse: true });


module.exports = mongoose.model("ReturnRequest", returnRequestSchema);
