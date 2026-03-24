const mongoose = require('mongoose');
const Order = require('../models/orderModel');
const paymentModel = require("../models/paymentModel");
const customer = require("../models/userModel");
const Product = require("../models/productModel");
const Razorpay = require("razorpay");

// exports.createOrderAndProcessPayment = async (req, res) => {

//     // // --- DB FIX: Run this once to fix the duplicate error ---
//     // await Order.collection.dropIndex('paymentOrderId_1').catch(() => { });
//     // // --------------------------------------------------------

//     const {
//         currency,
//         notes,
//         shippingInfo,
//         items,
//     } = req.body;

//     const customerid = req.user?._id || req.user; // Support both { _id } and raw ID from auth middleware

//     const razorpay = new Razorpay({
//         key_id: process.env.RAZORPAY_KEY_ID,
//         key_secret: process.env.RAZORPAY_KEY_SECRET,
//     });

//     try {
//         const user = await customer.findById(customerid);

//         if (!user) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         // VALIDATION: Ensure order items are present
//         if (!Array.isArray(items) || items.length === 0) {
//             return res.status(400).json({ success: false, message: "No items provided for the order" });
//         }

//         // 0. Validate stock and calculate totals based on current price
//         const productIds = items.map((item) => item.product);
//         const products = await Product.find({ _id: { $in: productIds } });
//         const productById = products.reduce((acc, product) => {
//             acc[product._id.toString()] = product;
//             return acc;
//         }, {});

//         let totalAmount = 0;
//         const processedItems = [];

//         for (const item of items) {
//             const prod = productById[item.product];
//             if (!prod) {
//                 return res.status(404).json({ success: false, message: `Product not found: ${item.product}` });
//             }

//             const quantity = Number(item.quantity);
//             if (quantity <= 0) {
//                 return res.status(400).json({ success: false, message: `Invalid quantity for ${prod.name}` });
//             }

//             if (prod.stock < quantity) {
//                 return res.status(400).json({
//                     success: false,
//                     message: `Insufficient stock for ${prod.name}. Available: ${prod.stock}`
//                 });
//             }

//             const priceAtOrder = prod.price;
//             const totalPrice = priceAtOrder * quantity;
//             totalAmount += totalPrice;

//             processedItems.push({
//                 product: prod._id,
//                 color: item.color,
//                 quantity,
//                 priceAtOrder,
//                 totalPrice,
//             });
//         }

//         // 1. Create Razorpay Order
//         const order = await razorpay.orders.create({
//             amount: totalAmount * 100, // Convert to paise
//             currency,
//             receipt: `receipt_${customerid}_${Date.now()}`,
//             notes,
//         });

//         // 2. Create Payment Log (using order.id)
//         const paymentEntry = await paymentModel.create({
//             customerid: user._id,
//             entity: order.entity,
//             amount: order.amount,
//             amount_paid: order.amount_paid,
//             amount_due: order.amount_due,
//             currency: order.currency,
//             receipt: order.receipt,
//             status: order.status,
//             attempts: order.attempts,
//             notes: order.notes,
//             created_at: order.created_at || new Date(),
//             order_id: order.id,
//         });

//         // 3. Create and Save Internal Order (using order.id)
//         const newOrder = new Order({
//             user: customerid,
//             items: processedItems,
//             shippingInfo,
//             totalAmount,
//             orderId: order.id, // Maps to the unique Razorpay ID
//             status: "pending",
//             statusHistory: [{ status: "pending", timestamp: new Date() }]
//         });

//         const savedOrder = await newOrder.save();

//         res.status(201).json({
//             success: true,
//             razorpayOrder: order,
//             savedOrder,
//             paymentEntry,
//         });

//     } catch (error) {
//         console.error("Error processing payment and creating order:", error);

//         // Log specifically if it's a duplicate error
//         if (error.code === 11000) {
//             console.log("Duplicate Key Detail:", error.keyValue);
//         }

//         res.status(500).json({ success: false, message: "Server Error" });
//     }
// };

// USER - Get My Orders
// USER: Get My Orders

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrderAndProcessPayment = async (req, res) => {

    const {
        currency,
        notes,
        shippingInfo,
        items,
    } = req.body;

    const customerid = req.user?._id || req.user;


    try {

        const user = await customer.findById(customerid);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No items provided for the order"
            });
        }

        const productIds = items.map((item) => item.product);

        const products = await Product.find({
            _id: { $in: productIds }
        });

        const productById = products.reduce((acc, product) => {
            acc[product._id.toString()] = product;
            return acc;
        }, {});

        let totalAmount = 0;

        const processedItems = [];

        for (const item of items) {

            const prod = productById[item.product];

            if (!prod) {
                return res.status(404).json({
                    success: false,
                    message: `Product not found: ${item.product}`
                });
            }

            const quantity = Number(item.quantity);

            if (quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid quantity for ${prod.name}`
                });
            }

            if (prod.stock < quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${prod.name}. Available: ${prod.stock}`
                });
            }

            const priceAtOrder = prod.price;

            const totalPrice = priceAtOrder * quantity;

            totalAmount += totalPrice;

            processedItems.push({
                product: prod._id,
                color: item.color,
                quantity,
                priceAtOrder,
                totalPrice,
            });
        }


        const receipt = `r_${customerid.toString().slice(-4)}_${Date.now().toString(36)}`;
        const razorpayOrder = await razorpay.orders.create({
            amount: totalAmount * 100,
            currency,
            receipt: receipt,
            notes,
        });

        const paymentEntry = await paymentModel.create({
            customerid: user._id,
            entity: razorpayOrder.entity,
            amount: razorpayOrder.amount,
            amount_paid: razorpayOrder.amount_paid,
            amount_due: razorpayOrder.amount_due,
            currency: razorpayOrder.currency,
            receipt: razorpayOrder.receipt,
            status: razorpayOrder.status,
            attempts: razorpayOrder.attempts,
            notes: razorpayOrder.notes,
            created_at: razorpayOrder.created_at || new Date(),
            order_id: razorpayOrder.id,
        });

        const newOrder = new Order({
            user: customerid,
            items: processedItems,
            shippingInfo,
            totalAmount,
            orderId: razorpayOrder.id,
            paymentStatus: "pending",
            orderStatus: "pending",
            statusHistory: [{
                status: "pending",
                timestamp: new Date()
            }]
        });

        const savedOrder = await newOrder.save();

        res.status(201).json({
            success: true,
            razorpayOrder,
            savedOrder,
            paymentEntry,
        });

    } catch (error) {

        console.error("Error processing payment and creating order:", error);

        if (error.code === 11000) {
            console.log("Duplicate Key Detail:", error.keyValue);
        }

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

exports.myOrders = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        const matchQuery = {
            user: req.user._id, // ✅ No mongoose.Types.ObjectId needed
        };

        if (search) {
            const regex = new RegExp(search, "i");
            matchQuery.$or = [
                { orderId: regex },
                { "shippingInfo.name": regex },
            ];
        }

        const orders = await Order.find(matchQuery)
            .populate("items.product", "name images price isReturnable isReplaceable returnWindowDays")
            .populate('returnRequest')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments(matchQuery);

        res.status(200).json({
            success: true,
            orders,
            pagination: {
                totalOrders,
                totalPages: Math.ceil(totalOrders / limit),
                currentPage: page,
            },
        });
    } catch (error) {
        console.error("My Orders Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching orders",
        });
    }
};

exports.getSingleOrder = async (req, res) => {
    console.log("Get Single Order - User ID:", req.user._id, "Order ID:", req.params.id); // Debugging line
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Order ID format",
            });
        }

        const order = await Order.findById(id)
            .populate("items.product");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // 🔐 Security Check (Allow the owner of the order OR an Admin)
        const isAdmin = req.user.role === 'admin' || (Array.isArray(req.user.role) && req.user.role.includes('admin'));

        if (order.user.toString() !== req.user._id.toString() && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to access this order",
            });
        }

        res.status(200).json({
            success: true,
            order,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};


// ADMIN - Get All Orders
exports.adminAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", startDate, endDate, paymentStatus } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        let matchQuery = {};

        // Date filter
        if (startDate || endDate) {
            matchQuery.createdAt = {};
            if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                matchQuery.createdAt.$lte = end;
            }
        }

        // Search filter
        if (search) {
            const regex = new RegExp(search, "i");
            matchQuery.$or = [
                { orderId: regex },
                { "shippingInfo.name": regex }
            ];
        }

        // ✅ Payment Status Filter (Separate)
        if (paymentStatus) {
            matchQuery.paymentStatus = paymentStatus;
        }

        const orders = await Order.find(matchQuery)
            .populate("user", "name email")
            .populate("items.product", "name price")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalOrders = await Order.countDocuments(matchQuery);

        res.status(200).json({
            success: true,
            orders,
            pagination: {
                totalOrders,
                totalPages: Math.ceil(totalOrders / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        console.error("Admin Orders Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error fetching admin orders",
        });
    }
};

// ADMIN - Update Order Status
// ADMIN: Update Order Status
exports.updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        order.orderStatus = status;
        // 2. ADDED: Push new status and timestamp to history array
        order.statusHistory.push({
            status: req.body.status,
            timestamp: new Date(),
            updatedBy: req.user.email // Assuming req.user contains admin's email
        });
        await order.save();

        res.status(200).json({
            success: true,
            message: `Order status updated to ${status}`,
            order,
        });
    } catch (error) {
        console.error("Update Order Error:", error);
        res.status(500).json({
            success: false,
            message: "Server error updating order",
        });
    }
};
