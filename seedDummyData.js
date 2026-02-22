const mongoose = require("mongoose");
require("dotenv").config();

// MODELS
const Category = require("./models/categoryModel");
const SubCategory = require("./models/subcategoryModel");
const Product = require("./models/productModel");
const Cart = require("./models/cartModel");
const Wishlist = require("./models/wishlistModel");
const Order = require("./models/orderModel");

const USER_ID = "68b9ac139d8d5b630ace1a45";

async function seed() {
    try {
        await mongoose.connect(process.env.DB_URI);
        console.log("✅ DB Connected");

        // 🔹 CATEGORY
        const raspberryCategory = await Category.create({
            name: "Raspberry Pi",
            description: "Raspberry Pi boards and accessories",
            image: "/category/raspberrypi.png",
        });

        const droneCategory = await Category.create({
            name: "Drone Parts",
            description: "Drone kits and components",
            image: "/category/drone.png",
        });

        // 🔹 SUB CATEGORIES
        const pi5Sub = await SubCategory.create({
            name: "Raspberry Pi 5",
            category: raspberryCategory._id,
            description: "Latest Raspberry Pi 5 series",
        });

        const droneKitSub = await SubCategory.create({
            name: "Drone Kit",
            category: droneCategory._id,
            description: "Complete drone kits",
        });

        // 🔹 PRODUCTS
        const pi2gb = await Product.create({
            name: "Raspberry Pi 5 2GB RAM",
            sku: "RPI5-2GB",
            manufacturer: "Raspberry Pi Foundation",
            category: raspberryCategory._id,
            subCategory: pi5Sub._id,
            description: "Raspberry Pi 5 with 2GB RAM",
            price: 4500,
            stock: 25,
            images: ["/products/pi5-2gb.png"],
        });


        const pi4gb = await Product.create({
            name: "Raspberry Pi 5 4GB RAM",
            sku: "RPI5-4GB",
            manufacturer: "Raspberry Pi Foundation",
            category: raspberryCategory._id,
            subCategory: pi5Sub._id,
            description: "Raspberry Pi 5 with 4GB RAM",
            price: 6500,
            stock: 20,
            images: ["/products/pi5-4gb.png"],
        });

        const pixhawk = await Product.create({
            name: "PIXHAWK 2.4.8 Combo Kit",
            manufacturer: "PX4",
            category: droneCategory._id,
            subCategory: droneKitSub._id,
            description: "Flight controller combo kit",
            price: 12500,
            stock: 10,
            images: ["/products/pixhawk.png"],
        });

        // 🔹 CART
        await Cart.create({
            user: USER_ID,
            items: [
                {
                    product: pi2gb._id,
                    quantity: 1,
                    priceAtAdd: pi2gb.price,
                },
                {
                    product: pixhawk._id,
                    quantity: 1,
                    priceAtAdd: pixhawk.price,
                },
            ],
        });

        // 🔹 WISHLIST
        await Wishlist.create({
            user: USER_ID,
            items: [
                { product: pi4gb._id },
                { product: pixhawk._id },
            ],
        });

        // 🔹 ORDER
        await Order.create({
            user: USER_ID,
            items: [
                {
                    product: pi2gb._id,
                    name: pi2gb.name,
                    manufacturer: pi2gb.manufacturer,
                    quantity: 1,
                    priceAtOrder: pi2gb.price,
                    totalPrice: pi2gb.price,
                },
            ],
            shippingInfo: {
                name: "Purvesh Prajapati",
                email: "prxdevs@gmail.com",
                address: "Ahmedabad, Gujarat",
                city: "Ahmedabad",
                pincode: 380001,
                mobile: 8401918193,
            },
            totalAmount: pi2gb.price,
            status: "completed",
        });

        console.log("🎉 Dummy data inserted successfully");
        process.exit();
    } catch (err) {
        console.error("❌ Error seeding data:", err);
        process.exit(1);
    }
}

seed();
