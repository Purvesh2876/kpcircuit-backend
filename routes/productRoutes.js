// productRoutes.js
const express = require('express');
const upload = require('../config/multerConfig'); // Your multer setup
const {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    searchProducts,
    addStock,
    getInventoryLogs
} = require('../controllers/productController');

const { isAuthenticated, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

// Create a new product with image upload
router.post('/', isAuthenticated, authorizeRoles('admin'), upload.array('images'), createProduct);

// add stock to a product
router.post("/:id/add-stock", isAuthenticated, authorizeRoles('admin'), addStock);

// Get inventory logs for a product
router.get("/:id/inventory", isAuthenticated, authorizeRoles('admin'), getInventoryLogs);

// Get all products
router.get('/', getAllProducts);

router.get('/search', searchProducts);

// Get a single product by ID
router.get('/:id', getProductById);

// Update a product
router.put('/:id', isAuthenticated, authorizeRoles('admin'), upload.array('images'), updateProduct);

// Delete a product
router.delete('/:id', isAuthenticated, authorizeRoles('admin'), deleteProduct);

module.exports = router;
