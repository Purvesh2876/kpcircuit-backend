const crypto = require("crypto");
const { finalizeOrder } = require("../utils/orderService");

exports.razorpayWebhook = async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    // 1️⃣ Verify Webhook Signature
    const generatedSignature = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(req.body))
        .digest("hex");

    if (generatedSignature !== signature) {
        return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body.event;

    try {
        // 2️⃣ Handle Payment Captured Event
        if (event === "payment.captured") {
            const payment = req.body.payload.payment.entity;
            const orderId = payment.order_id;

            // 🚀 FINALIZING ORDER (WORLD-CLASS FALLBACK)
            // Even if the user closes their browser, the webhook will ensure
            // stock is deducted and payment is recorded safely via orderService.
            await finalizeOrder(orderId, payment.id, "webhook");
        }

        res.json({ status: "ok" });
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
};