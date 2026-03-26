const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  customerid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Assuming you use User model
    required: false,
  },
  payment_id: {
    type: String,
  },
  entity: {
    type: String,
    required: false,
  },
  amount: {
    type: Number,
    required: true,
  },
  amount_paid: {
    type: Number,
    default: 0,
  },
  amount_due: {
    type: Number,
    required: false,
  },
  currency: {
    type: String,
    required: true,
  },
  receipt: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    enum: ["created", "attempted", "paid", "failed"],
    default: "created",
  },
  attempts: {
    type: Number,
    default: 0,
  },
  notes: {
    type: Map,
    of: String,
    default: {},
  },
  created_at: {
    type: Date,
    required: true,
  },
  order_id: {
    type: String,
    required: true,
  },
}, { timestamps: true });

// Export the model
module.exports = mongoose.model("Payment", paymentSchema);
