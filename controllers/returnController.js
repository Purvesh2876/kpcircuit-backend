const mongoose = require("mongoose");
const ReturnRequest = require('../models/returnRequestModel');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const InventoryLog = require('../models/inventoryLogModel');
const User = require('../models/userModel');
const ErrorHander = require('../utils/ErrorHander');
const catchAsyncErrors = require('../utils/catchAsyncErrors');

exports.createReturnRequest = catchAsyncErrors(async (req, res, next) => {
    const { orderId, reason, type } = req.body;
    let { items } = req.body;
    const userId = req.user._id;

    if (typeof items === 'string') {
        try {
            items = JSON.parse(items);
        } catch (error) {
            return next(new ErrorHander('Invalid items format.', 400));
        }
    }

    if (!orderId || !items || !items.length || !reason || !type) {
        return next(new ErrorHander('Missing required fields.', 400));
    }

    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
        return next(new ErrorHander('Order not found.', 404));
    }

    if (order.user.toString() !== userId.toString()) {
        return next(new ErrorHander('You are not authorized to access this order.', 403));
    }

    const deliveredStatus = order.statusHistory.find(s => s.status === 'delivered');
    if (!deliveredStatus) {
        return next(new ErrorHander('Return can only be requested for delivered orders.', 400));
    }

    for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product) {
            return next(new ErrorHander(`Product with ID ${item.product} not found.`, 404));
        }

        const returnWindow = product.returnWindowDays || 0;
        const daysSinceDelivery = (Date.now() - new Date(deliveredStatus.timestamp).getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceDelivery > returnWindow) {
            return next(new ErrorHander(`Return window for product "${product.name}" has expired.`, 400));
        }

        if (!product.isReturnable) {
            return next(new ErrorHander(`Product "${product.name}" is not returnable.`, 400));
        }

        if (type === 'REPLACEMENT' && !product.isReplaceable) {
            return next(new ErrorHander(`Product "${product.name}" is not replaceable.`, 400));
        }

        const existingRequest = await ReturnRequest.findOne({ order: orderId, 'items.product': item.product });
        if (existingRequest) {
            return next(new ErrorHander(`A return request for "${product.name}" already exists for this order.`, 400));
        }
    }
    const images = req.files
        ? req.files.map(file => `/returns/${file.filename}`)
        : [];

    const newReturnRequest = await ReturnRequest.create({
        order: orderId,
        user: userId,
        items,
        type,
        reason,
        images,
        status: 'REQUESTED',
        statusHistory: [{ status: 'REQUESTED', updatedBy: 'user' }]
    });

    res.status(201).json({
        success: true,
        data: newReturnRequest,
    });
});

// For users to get their own return requests
exports.getReturnRequests = catchAsyncErrors(async (req, res, next) => {
    const returnRequests = await ReturnRequest.find({ user: req.user._id })
        .populate('order', 'orderId')
        .populate('items.product', 'name images')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        data: returnRequests,
    });
});

// For admins to get all return requests
exports.adminGetAllReturnRequests = catchAsyncErrors(async (req, res, next) => {
    const dbUser = await User.findById(req.user._id);
    if (!dbUser || !dbUser.role.includes('admin')) {
        return next(new ErrorHander('Not authorized to access this resource.', 403));
    }

    const returnRequests = await ReturnRequest.find()
        .populate('user', 'name email')
        .populate('order', 'orderId')
        .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        data: returnRequests,
    });
});

// For a user or admin to get a single return request by ID
exports.getReturnRequestById = catchAsyncErrors(async (req, res, next) => {
    const returnRequest = await ReturnRequest.findById(req.params.id)
        .populate('user', 'name email')
        .populate('order')
        .populate('items.product');

    if (!returnRequest) {
        return next(new ErrorHander('Return request not found.', 404));
    }

    // Ensure user is authorized or is an admin
    const dbUser = await User.findById(req.user._id);
    const isAdmin = dbUser && dbUser.role.includes('admin');

    if (returnRequest.user._id.toString() !== req.user._id.toString() && !isAdmin) {
        return next(new ErrorHander('Not authorized to view this return request.', 403));
    }

    res.status(200).json({
        success: true,
        data: returnRequest,
    });
});

// For an admin to update the status of a return request
exports.adminUpdateReturnStatus = catchAsyncErrors(async (req, res, next) => {
    const dbUser = await User.findById(req.user._id);
    if (!dbUser || !dbUser.role.includes('admin')) {
        return next(new ErrorHander('Not authorized to access this resource.', 403));
    }

    const { status } = req.body;
    const validStatuses = ["APPROVED", "REJECTED", "PICKED"]; // RECEIVED is handled by processReturn

    if (!status || !validStatuses.includes(status)) {
        return next(new ErrorHander('Invalid status provided.', 400));
    }

    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
        return next(new ErrorHander('Return request not found.', 404));
    }

    returnRequest.status = status;
    returnRequest.statusHistory.push({
        status,
        updatedBy: req.user.email,
    });

    await returnRequest.save();

    res.status(200).json({
        success: true,
        message: `Return request status updated to ${status}.`,
        data: returnRequest,
    });
});

// For an admin to process a return (i.e., mark as received and update stock)
exports.adminProcessReturn = catchAsyncErrors(async (req, res, next) => {
    const dbUser = await User.findById(req.user._id);
    if (!dbUser || !dbUser.role.includes('admin')) {
        return next(new ErrorHander('Not authorized to access this resource.', 403));
    }

    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
        return next(new ErrorHander('Return request not found.', 404));
    }

    if (returnRequest.status !== 'PICKED' && returnRequest.status !== 'APPROVED') {
        return next(new ErrorHander(`Cannot mark as received. Current status is ${returnRequest.status}.`, 400));
    }
    if (returnRequest.status === 'RECEIVED') {
        return next(new ErrorHander(`Return has already been marked as received.`, 400));
    }

    try {
        for (const item of returnRequest.items) {
            // 1. Update product stock
            await Product.updateOne(
                { _id: item.product },
                { $inc: { stock: item.quantity } }
            );

            // 2. Create an inventory log
            await InventoryLog.create({
                product: item.product,
                type: 'IN',
                quantity: item.quantity,
                reason: 'RETURN',
                note: `Return for order #${returnRequest.order}`,
                createdBy: dbUser.email,
            });
        }

        // 3. Update return request status
        returnRequest.status = 'RECEIVED';
        returnRequest.statusHistory.push({
            status: 'RECEIVED',
            updatedBy: dbUser.email,
        });

        await returnRequest.save();

        res.status(200).json({
            success: true,
            message: 'Return processed successfully and stock updated.',
            data: returnRequest,
        });

    } catch (error) {
        return next(new ErrorHander('Return processing failed: ' + error.message, 500));
    }
});

const { refundOrder } = require("../utils/orderService");

exports.processRefund = catchAsyncErrors(async (req, res, next) => {
    const dbUser = await User.findById(req.user._id);
    if (!dbUser || !dbUser.role.includes("admin")) {
        return next(new ErrorHander("Not authorized to access this resource.", 403));
    }

    const returnRequest = await ReturnRequest.findById(req.params.id).populate("order");
    if (!returnRequest) {
        return next(new ErrorHander("Return request not found.", 404));
    }

    if (returnRequest.status !== "RECEIVED") {
        return next(new ErrorHander(`Refund can only be processed for RECEIVED returns. Current status: ${returnRequest.status}`, 400));
    }

    if (returnRequest.refundStatus === "PROCESSED") {
        return next(new ErrorHander("Refund has already been processed.", 400));
    }

    try {
        // 🚀 REAL RAZORPAY REFUND
        await refundOrder(returnRequest.order, dbUser.email);

        returnRequest.refundStatus = "PROCESSED";
        returnRequest.status = "COMPLETED";
        returnRequest.statusHistory.push({
            status: "COMPLETED",
            updatedBy: dbUser.email,
        });

        await returnRequest.save();

        res.status(200).json({
            success: true,
            message: "Refund processed via Razorpay and request completed.",
            data: returnRequest,
        });
    } catch (error) {
        return next(new ErrorHander(`Refund failed: ${error.message}`, 500));
    }
});

// For an admin to create a replacement order
exports.createReplacementOrder = catchAsyncErrors(async (req, res, next) => {
    const dbUser = await User.findById(req.user._id);
    if (!dbUser || !dbUser.role.includes('admin')) {
        return next(new ErrorHander('Not authorized to access this resource.', 403));
    }

    const returnRequest = await ReturnRequest.findById(req.params.id).populate('order');
    if (!returnRequest) {
        return next(new ErrorHander('Return request not found.', 404));
    }

    if (returnRequest.status !== 'RECEIVED') {
        return next(new ErrorHander(`Replacement can only be created for RECEIVED returns. Current status: ${returnRequest.status}`, 400));
    }

    if (returnRequest.replacementOrder) {
        return next(new ErrorHander('A replacement order has already been created.', 400));
    }

    try {
        let totalAmount = 0;
        const processedItems = [];
        let forceRefund = false;
        const rollbacks = []; // To keep track if we need to manually revert stock

        for (const item of returnRequest.items) {
            const product = await Product.findById(item.product);
            if (!product) {
                throw new Error(`Product with ID ${item.product} not found.`);
            }

            if (product.stock < item.quantity) {
                forceRefund = true;
                break; // Exit loop, we have to refund
            }

            // Deduct stock
            product.stock -= item.quantity;
            await product.save();
            rollbacks.push({ product: product, quantity: item.quantity }); // Track for rollback

            // Create inventory log
            await InventoryLog.create({
                product: product._id,
                type: 'OUT',
                quantity: item.quantity,
                reason: 'REPLACEMENT',
                note: `Replacement for order #${returnRequest.order.orderId}`,
                createdBy: dbUser.email,
            });

            processedItems.push({
                product: product._id,
                quantity: item.quantity,
                priceAtOrder: 0, // Replacements are free
                totalPrice: 0,
            });
        }

        if (forceRefund) {
            // Manual Rollback if one of the items was out of stock
            for (const r of rollbacks) {
                r.product.stock += r.quantity;
                await r.product.save();

                await InventoryLog.create({
                    product: r.product._id,
                    type: 'IN',
                    quantity: r.quantity,
                    reason: 'RETURN',
                    note: `Refund fallback correction for order #${returnRequest.order.orderId}`,
                    createdBy: 'system',
                });
            }

            // Fallback to refund
            returnRequest.type = 'REFUND';
            returnRequest.refundStatus = 'PENDING';
            await returnRequest.save();

            return res.status(200).json({
                success: true,
                message: 'Product out of stock. The request has been automatically converted to a refund.',
                data: returnRequest,
            });
        }

        // Create the new replacement order
        const newOrder = new Order({
            user: returnRequest.user,
            items: processedItems,
            shippingInfo: returnRequest.order.shippingInfo,
            totalAmount: 0,
            orderId: `REPL-${returnRequest.order.orderId}`,
            paymentStatus: 'paid', // Replacement is pre-authorized
            orderStatus: 'payment confirmed',
            statusHistory: [{ status: 'payment confirmed', timestamp: new Date(), updatedBy: 'system' }],
            isReplacement: true,
            originalOrder: returnRequest.order._id
        });

        const savedOrder = await newOrder.save();

        // Update the return request
        await returnRequest.save();

        // 🚀 Update the ORIGINAL order status to 'replaced'
        const originalOrder = returnRequest.order;
        originalOrder.orderStatus = 'replaced';
        if (!originalOrder.statusHistory) originalOrder.statusHistory = [];
        originalOrder.statusHistory.push({
            status: 'replaced',
            timestamp: new Date(),
            updatedBy: dbUser.email,
        });
        await originalOrder.save();

        res.status(201).json({
            success: true,
            message: 'Replacement order created successfully.',
            data: {
                returnRequest,
                newOrder: savedOrder,
            },
        });

    } catch (error) {
        return next(new ErrorHander('Replacement creation failed: ' + error.message, 500));
    }
});
