const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { createOrderAndProcessPayment, myOrders, adminAllOrders, updateOrderStatus, getSingleOrder } = require('../controllers/orderController');
const { savePayment, verifyPayment } = require('../controllers/paymentController');
const { razorpayWebhook } = require("../controllers/webhookController");

router.post('/createOrder', isAuthenticated, createOrderAndProcessPayment)
// Get My Orders
router.get('/myOrders', isAuthenticated, myOrders);


router.post('/payments', savePayment);

router.post('/verify', verifyPayment)

// Admin Routes
// Get All Orders (Admin)
router.get('/admin/allOrders', isAuthenticated, adminAllOrders);

// Update Order Status (Admin)
router.put('/admin/updateOrder/:id', isAuthenticated, updateOrderStatus);

// webhook route (No auth needed as Razorpay will call this)
router.post("/razorpay-webhook", razorpayWebhook);

// Always Last: Get Single Order (Admin & User)
router.get("/:id", isAuthenticated, getSingleOrder);

module.exports = router;
