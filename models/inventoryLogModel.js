const mongoose = require("mongoose");

const inventoryLogSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["IN", "OUT"],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    reason: {
      type: String,
      enum: ["INITIAL", "PURCHASE", "SALE", "RETURN", "ADJUSTMENT", "REPLACEMENT", "CANCELLED"],
      required: true,
    },

    note: {
      type: String,
      default: "",
    },

    createdBy: {
      type: String, // admin email or system
      default: "system",
    },
  },
  { timestamps: true }
);

// 🔥 Important for performance later
inventoryLogSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryLog", inventoryLogSchema);