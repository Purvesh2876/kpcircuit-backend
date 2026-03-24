const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middlewares/authMiddleware');
const upload = require('../config/multerConfig');

const {
    createReturnRequest,
    getReturnRequests,
    getReturnRequestById,
    adminUpdateReturnStatus,
    adminGetAllReturnRequests,
    adminProcessReturn,
    processRefund,
    createReplacementOrder
} = require('../controllers/returnController');

// USER - Create a new return request
router.post('/', isAuthenticated, upload.array('images', 5), createReturnRequest);

// USER - Get their own return requests
router.get('/', isAuthenticated, getReturnRequests);

// ADMIN - Get all return requests
router.get('/admin/all', isAuthenticated, adminGetAllReturnRequests);

// USER / ADMIN - Get a single return request by ID
router.get('/:id', isAuthenticated, getReturnRequestById);

// ADMIN - Update a return request's status (approve, reject, etc.)
router.put('/admin/status/:id', isAuthenticated, adminUpdateReturnStatus);

// ADMIN - Process a received return and update stock
router.put('/admin/process/:id', isAuthenticated, adminProcessReturn);

// ADMIN - Process a refund for a received return
router.put('/admin/refund/:id', isAuthenticated, processRefund);

// ADMIN - Create a replacement order for a received return
router.post('/admin/replacement/:id', isAuthenticated, createReplacementOrder);

module.exports = router;
