// models/Order.js
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: String,
    manufacturer: String,
    quantity: Number,
    priceAtOrder: Number,
    totalPrice: Number,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderId: {
      type: String,
      required: true,
      unique: true, // This allows us to search by Razorpay ID later
    },

    items: [orderItemSchema],

    shippingInfo: {
      name: String,
      mobile: String,
      address: String,
      city: String,
      pincode: String,
    },

    totalAmount: {
      type: Number,
      required: true,
    },
    // Add this to your Order Schema
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: String } // To store the admin's email
      }
    ],
    // razorpayOrderId: { type: String, unique: true, required: true }, // Matches Razorpay's 'order_id'
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    stockDeducted: {
      type: Boolean,
      default: false,
    },
    orderStatus: {
      type: String,
      enum: ["pending", "placed", "packed", "shipped", "delivered", "cancelled"],
      default: "placed",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
