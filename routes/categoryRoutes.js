// categoryRoutes.js
const express = require('express');
const upload = require('../config/multerConfig'); // Your multer setup
const {
    createCategory,
    getAllCategories,
    updateCategory,
    deleteCategory,
    getCategoryById
} = require('../controllers/categoryController');
const { isAuthenticated } = require('../middlewares/authMiddleware');

const router = express.Router();

// Create a new category with image upload
// router.post('/', upload.array('image'), isAuthenticated, createCategory); // Make sure to use upload.array('image')
router.post('/', upload.single('image'), isAuthenticated, createCategory); // Make sure to use upload.array('image')

// Get all categories
router.get('/', getAllCategories);

// Get a single category by ID
// router.get('/:id', getCategoryById);

// Update a category by ID
router.put('/:id', upload.single('image'), updateCategory); // Ensure to use upload.array('image')

// Delete a category by ID
router.delete('/:id', deleteCategory);

module.exports = router;
