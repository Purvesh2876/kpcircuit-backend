const crypto = require("crypto");
const Order = require("../models/orderModel");
const Payment = require("../models/paymentModel");

exports.razorpayWebhook = async (req, res) => {

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const signature = req.headers["x-razorpay-signature"];

    const generatedSignature = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(req.body))
        .digest("hex");

    if (generatedSignature !== signature) {
        return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body.event;

    try {

        if (event === "payment.captured") {

            const payment = req.body.payload.payment.entity;

            const orderId = payment.order_id;

            const order = await Order.findOne({ orderId });

            if (!order) return res.status(404).json({ message: "Order not found" });

            if (order.paymentStatus === "paid") {
                return res.json({ message: "Already processed" });
            }

            order.paymentStatus = "paid";
            order.orderStatus = "packed";

            order.statusHistory.push({
                status: "paid",
                timestamp: new Date(),
                updatedBy: "webhook"
            });

            await order.save();

            await Payment.findOneAndUpdate(
                { order_id: orderId },
                {
                    status: "paid",
                    payment_id: payment.id,
                    amount_paid: payment.amount,
                    payment_method: payment.method
                }
            );
        }

        res.json({ status: "ok" });

    } catch (error) {

        console.error("Webhook Error:", error);

        res.status(500).json({ error: "Webhook processing failed" });

    }
};