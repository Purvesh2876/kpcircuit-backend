const mongoose = require('mongoose');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const InventoryLog = require('../models/inventoryLogModel');
const Payment = require('../models/paymentModel');
const { runInTransaction } = require('./transactionHelper');

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
                // Note: using amount_paid and payment_id if they exist in your schema
                // Based on your paymentModel.js
                // payment_id is not in schema but status is.
            },
            { session }
        );

        return order;
    });
};
