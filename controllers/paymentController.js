const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/paymentModel'); // Check your file path
const Order = require('../models/orderModel'); // Check your file path (might be orderModel)
const Product = require('../models/productModel');
InventoryLog = require('../models/inventoryLogModel'); // Check your file path

// Function to save payment details (Optional: If createOrder handles this, this might be unused, but keeping it to prevent router errors)
const savePayment = async (req, res) => {
    const { orderId, paymentId, amount, currency, status } = req.body;

    try {
        const paymentData = {
            order_id: orderId,
            payment_id: paymentId,
            amount,
            currency,
            status,
        };

        const payment = await Payment.create(paymentData);
        res.status(201).json(payment);
    } catch (error) {
        console.error('Error saving payment:', error);
        res.status(500).json({ error: 'Error saving payment' });
    }
};

const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET;

    try {
        // 1️⃣ Verify Razorpay Signature
        const generated_signature = crypto.createHmac("sha256", secret)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generated_signature !== razorpay_signature) {
            await Payment.findOneAndUpdate(
                { order_id: razorpay_order_id },
                { status: "failed" }
            );

            return res.status(400).json({
                success: false,
                message: "Signature verification failed"
            });
        }

        // 2️⃣ Fetch Razorpay Payment Details
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

        // 3️⃣ Find Payment Entry
        const paymentEntry = await Payment.findOne({ order_id: razorpay_order_id });

        if (!paymentEntry) {
            return res.status(404).json({
                success: false,
                message: "Payment record not found"
            });
        }

        // 4️⃣ Find Order Entry
        const orderEntry = await Order.findOne({ orderId: razorpay_order_id });

        if (!orderEntry) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // 5️⃣ Prevent Duplicate Verification
        if (orderEntry.paymentStatus === "paid") {
            return res.json({
                success: true,
                message: "Payment already verified"
            });
        }

        // 6️⃣ Verify Amount
        const paidAmount = paymentDetails.amount / 100;

        if (paidAmount !== orderEntry.totalAmount) {
            return res.status(400).json({
                success: false,
                message: "Amount mismatch"
            });
        }

        // 🔥 7️⃣ Prevent duplicate stock deduction
        if (orderEntry.stockDeducted) {
            return res.json({
                success: true,
                message: "Stock already deducted"
            });
        }

        // ==============================
        // 🔥 TRANSACTION STARTS HERE
        // ==============================

        const mongoose = require("mongoose");
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 🔁 Loop through items
            for (const item of orderEntry.items) {

                // Try atomic update
                const updatedProduct = await Product.findOneAndUpdate(
                    { _id: item.product, stock: { $gte: item.quantity } },
                    { $inc: { stock: -item.quantity } },
                    { new: true, session }
                );

                if (!updatedProduct) {

                    // 🔥 Fetch product name ONLY for error message
                    const product = await Product.findById(item.product).select("name");

                    throw new Error(
                        `${product?.name || "Product"} is out of stock. Please remove it from cart.`
                    );
                }

                // Create log
                await InventoryLog.create([{
                    product: item.product,
                    type: "OUT",
                    quantity: item.quantity,
                    reason: "SALE",
                    note: `Order ID: ${orderEntry._id}`,
                    createdBy: "system",
                }], { session });
            }

            // ✅ Mark stock deducted
            await Order.findByIdAndUpdate(
                orderEntry._id,
                { stockDeducted: true },
                { session }
            );

            // ✅ Update order status
            orderEntry.paymentStatus = "paid";
            orderEntry.orderStatus = "packed";

            orderEntry.statusHistory.push({
                status: "paid",
                timestamp: new Date(),
                updatedBy: "system"
            });

            await orderEntry.save({ session });

            // ✅ Update payment entry
            paymentEntry.status = "paid";
            paymentEntry.payment_id = razorpay_payment_id;
            paymentEntry.signature = razorpay_signature;
            paymentEntry.amount_paid = paymentDetails.amount;
            paymentEntry.payment_method = paymentDetails.method;

            await paymentEntry.save({ session });

            // ✅ Commit transaction
            await session.commitTransaction();
            session.endSession();

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }

        // ==============================
        // 🔥 TRANSACTION ENDS HERE
        // ==============================

        return res.json({
            success: true,
            message: "Payment verified successfully",
            orderId: orderEntry._id
        });

    } catch (error) {
        console.error("Verification Error:", error);

        return res.status(400).json({
            success: false,
            message: error.message || "Something went wrong"
        });
    }
};

module.exports = {
    savePayment,
    verifyPayment
};