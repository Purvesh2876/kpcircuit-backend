// models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        manufacturer: {
            type: String,
            required: true,
            trim: true,
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },

        subCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SubCategory",
            required: true,
        },

        description: {
            type: String,
            default: "",
        },

        price: {
            type: Number,
            required: true,
        },

        stock: {
            type: Number,
            required: true,
            min: 0,
        },

        images: {
            type: [String],
            required: true,
        },

        sku: {
            type: String,
            unique: true,
            sparse: true,
        },

        featured: {
            type: Boolean,
            default: false,
        },

        isReturnable: {
            type: Boolean,
            default: true,
        },

        isReplaceable: {
            type: Boolean,
            default: true,
        },

        returnWindowDays: {
            type: Number,
            default: 7,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
