const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/paymentModel');
const Order = require('../models/orderModel');
const { finalizeOrder } = require('../utils/orderService');

// Function to save payment details
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

        // 🚀 2️⃣ FINALIZING ORDER (WORLD-CLASS)
        // This handles stock, status, and logs safely via centralized service.
        // It's idempotent, so if the webhook also tries to run this, it won't double-deduct.
        const order = await finalizeOrder(
            razorpay_order_id, 
            razorpay_payment_id, 
            "user"
        );

        res.status(200).json({
            success: true,
            message: "Payment verified and order finalized successfully",
            order,
        });

    } catch (error) {
        console.error("Verification Error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Payment verification failed",
        });
    }
};

module.exports = {
    savePayment,
    verifyPayment
};