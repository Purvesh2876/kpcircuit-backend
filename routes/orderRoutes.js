const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/authMiddleware');
const { createOrderAndProcessPayment, myOrders, adminAllOrders, updateOrderStatus } = require('../controllers/orderController');
const { savePayment, verifyPayment } = require('../controllers/paymentController');

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

module.exports = router;
