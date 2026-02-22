const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  customerid: {
    type: mongoose.Schema.Types.ObjectId, // Link to the customer/user
    ref: "Customer", // Assuming you have a Customer model
    required: true,
  },
  entity: {
    type: String,
    required: true,
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
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  receipt: {
    type: String,
    required: true,
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
