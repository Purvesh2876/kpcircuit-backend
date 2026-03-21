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
const { isAuthenticated, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

// Create a new category with image upload
router.post('/', isAuthenticated, authorizeRoles('admin'), upload.single('image'), createCategory); 

// Get all categories
router.get('/', getAllCategories);

// Get a single category by ID
// router.get('/:id', getCategoryById);

// Update a category by ID
router.put('/:id', isAuthenticated, authorizeRoles('admin'), upload.single('image'), updateCategory); 

// Delete a category by ID
router.delete('/:id', isAuthenticated, authorizeRoles('admin'), deleteCategory);

module.exports = router;
