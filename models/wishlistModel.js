const mongoose = require("mongoose");

// Wishlist Item Schema
const WishlistItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
//   color: { type: String, required: true },  // Identifying variant attribute
//   quantity: { type: Number, required: true, min: 1, default: 1 },
//   priceAtAdd: { type: Number, required: true },
//   totalPrice: { type: Number }, // Total price calculated as quantity * priceAtAdd
  addedAt: { type: Date, default: Date.now }
});

// Wishlist Schema
const WishlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [WishlistItemSchema],
  status: { type: String, enum: ["active", "checked out"], default: "active" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now } // Track the last updated time
});

// Middleware to update the updatedAt field
WishlistSchema.pre("save", function(next) {
  this.updatedAt = Date.now(); // Set updatedAt to current time
  next();
});

// Virtual for calculating total price of the Wishlist
// WishlistSchema.virtual("totalPrice").get(function() {
//   return this.items.reduce((total, item) => {
//     return total + item.priceAtAdd * item.quantity;
//   }, 0);
// });

// Ensure virtual fields are included in toJSON and toObject
WishlistSchema.set("toJSON", { virtuals: true });
WishlistSchema.set("toObject", { virtuals: true });

// Export the Wishlist model
module.exports = mongoose.model("Wishlist", WishlistSchema);