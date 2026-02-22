// productRoutes.js
const express = require('express');
const upload = require('../config/multerConfig'); // Your multer setup
const {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    searchProducts
} = require('../controllers/productController');

const router = express.Router();

// Create a new product with image upload
router.post('/', upload.array('images'), createProduct); // Use upload.array('images')

// Get all products
router.get('/', getAllProducts);

router.get('/search', searchProducts);

// Get a single product by ID
router.get('/:id', getProductById);

// Update a product
router.put('/:id', upload.array('images'), updateProduct); // Use upload.array('images')

// Delete a product
router.delete('/:id', deleteProduct);

module.exports = router;
