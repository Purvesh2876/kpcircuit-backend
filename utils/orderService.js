const mongoose = require('mongoose');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const InventoryLog = require('../models/inventoryLogModel');
const Payment = require('../models/paymentModel');
const { runInTransaction } = require('./transactionHelper');
const Razorpay = require('razorpay');
const sendEmail = require('./sendEmail');

/**
 * Finalizes an order after a successful payment.
 * Handles stock deduction, inventory logging, and status updates.
 * This function is IDEMPOTENT (safe to call multiple times).
 */
exports.finalizeOrder = async (orderId, razorpayPaymentId, updatedBy = 'system') => {
    return await runInTransaction(async (session) => {
        // 1. Find the order by Razorpay Order ID (stored in orderId field)
        const order = await Order.findOne({ orderId }).session(session);
        if (!order) {
            throw new Error(`Order not found: ${orderId}`);
        }

        // 2. IDEMPOTENCY CHECK: If already processed, just return success
        if (order.paymentStatus === 'paid' && order.stockDeducted) {
            console.log(`Order ${orderId} already processed.`);
            return order;
        }

        // 3. DEDUCT STOCK (if not already done)
        if (!order.stockDeducted) {
            for (const item of order.items) {
                const updatedProduct = await Product.findOneAndUpdate(
                    { _id: item.product, stock: { $gte: item.quantity } },
                    { $inc: { stock: -item.quantity } },
                    { new: true, session }
                );

                if (!updatedProduct) {
                    const product = await Product.findById(item.product).session(session);
                    throw new Error(
                        `Product "${product?.name || 'Unknown'}" is out of stock.`
                    );
                }

                // Create inventory log
                await InventoryLog.create([{
                    product: item.product,
                    type: 'OUT',
                    quantity: item.quantity,
                    reason: 'SALE',
                    note: `Order: ${order.orderId}`,
                    createdBy: updatedBy,
                }], { session });
            }

            order.stockDeducted = true;
        }

        // 4. UPDATE ORDER STATUS
        order.paymentStatus = 'paid';
        if (order.orderStatus === 'placed' || order.orderStatus === 'pending') {
            order.orderStatus = 'packed';
        }

        order.statusHistory.push({
            status: 'paid',
            timestamp: new Date(),
            updatedBy: updatedBy
        });

        await order.save({ session });

        // 5. UPDATE PAYMENT RECORD
        await Payment.findOneAndUpdate(
            { order_id: orderId },
            { 
                status: 'paid',
                payment_id: razorpayPaymentId,
            },
            { session }
        );

        return order;
    });
};

/**
 * Initiates a refund for a given order via Razorpay and sends notification.
 */
exports.refundOrder = async (order, updatedBy = 'system') => {
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // 1. Find the payment ID associated with this order
    let payment = await Payment.findOne({ order_id: order.orderId, status: 'paid' });
    let razorpayPaymentId = payment?.payment_id;

    // FALLBACK: If not in DB, try to fetch from Razorpay directly (resilience for old orders)
    if (!razorpayPaymentId) {
        try {
            const payments = await razorpay.orders.fetchPayments(order.orderId);
            const capturedPayment = payments.items.find(p => p.status === 'captured');
            if (capturedPayment) {
                razorpayPaymentId = capturedPayment.id;
                // Update DB for future use
                if (payment) {
                    payment.payment_id = razorpayPaymentId;
                    await payment.save();
                } else {
                    await Payment.create({
                        order_id: order.orderId,
                        payment_id: razorpayPaymentId,
                        status: 'paid',
                        amount: order.totalAmount,
                        currency: 'INR',
                        created_at: new Date()
                    });
                }
            }
        } catch (fetchErr) {
            console.error("Razorpay Payment Fetch Failed:", fetchErr.message);
        }
    }

    if (!razorpayPaymentId) {
        throw new Error(`Paid payment record not found for order: ${order.orderId}. Please refund manually via Razorpay Dashboard.`);
    }

    try {
        const refund = await razorpay.payments.refund(razorpayPaymentId, {
            amount: order.totalAmount * 100, // Amount in paise
            notes: {
                order_id: order.orderId,
                reason: 'Cancellation/Return',
                updated_by: updatedBy,
            }
        });

        order.refundStatus = 'PROCESSED';
        order.refundId = refund.id;
        order.orderStatus = 'refunded';
        order.statusHistory.push({
            status: 'refunded',
            timestamp: new Date(),
            updatedBy: updatedBy
        });
        await order.save();

        // 📧 Professional Email Notification
        // Ensure user is populated or we have some way to get the email
        let recipientEmail = order.shippingInfo?.email;
        if (!recipientEmail && order.user) {
            // If user is just an ID, we might need to fetch it
            if (typeof order.user === 'object' && order.user.email) {
                recipientEmail = order.user.email;
            } else {
                // Fetch the user to get the email
                const user = await mongoose.model('User').findById(order.user);
                recipientEmail = user?.email;
            }
        }

        if (recipientEmail) {
            try {
                await sendEmail({
                    email: recipientEmail,
                    subject: `Refund Processed for Order #${order.orderId}`,
                    message: `
                        <h1>Refund Successful</h1>
                        <p>Dear Customer,</p>
                        <p>We have processed a refund of <b>₹${order.totalAmount}</b> for your order <b>#${order.orderId}</b>.</p>
                        <p>The amount has been credited back to your original payment method. It usually takes 5-7 business days to reflect in your account.</p>
                        <p>Thank you for shopping with KP Circuit!</p>
                    `
                });
            } catch (emailErr) {
                console.error("Email notification failed:", emailErr.message);
            }
        } else {
            console.warn(`Could not send refund email: No email found for order ${order.orderId}`);
        }

        return refund;
    } catch (error) {
        order.refundStatus = 'FAILED';
        await order.save();
        throw new Error(`Razorpay Refund Failed: ${error.message}`);
    }
};

/**
 * Cancels an order, restocks items and processes refund if paid.
 */
exports.cancelAndRestockOrder = async (orderId, updatedBy = 'system') => {
    return await runInTransaction(async (session) => {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new Error(`Order not found: ${orderId}`);

        if (order.orderStatus === 'cancelled') {
            return order; // Already cancelled
        }

        // 1. RESTOCK ITEMS
        if (order.stockDeducted) {
            for (const item of order.items) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { stock: item.quantity } },
                    { session }
                );

                // Create inventory log
                await InventoryLog.create([{
                    product: item.product,
                    type: 'IN',
                    quantity: item.quantity,
                    reason: 'CANCELLED',
                    note: `Order cancellation: ${order.orderId}`,
                    createdBy: updatedBy,
                }], { session });
            }
            order.stockDeducted = false;
        }

        // 2. UPDATE STATUS
        order.orderStatus = 'cancelled';
        order.statusHistory.push({
            status: 'cancelled',
            timestamp: new Date(),
            updatedBy: updatedBy,
        });

        await order.save({ session });

        // 3. Mark for Refund if paid
        if (order.paymentStatus === 'paid') {
            order.refundStatus = 'PENDING';
            await order.save({ session });
        }

        return order;
    });
};
