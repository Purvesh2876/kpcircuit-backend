const express = require("express");
const router = express.Router();
const upload = require("../config/multerConfig");

const {
  createSubCategory,
  getAllSubCategories,
  getSubCategoriesByCategory,
  updateSubCategory,
  deleteSubCategory,
} = require("../controllers/subcategoryController");

/**
 * Admin – Create subcategory
 */
router.post("/", upload.single("image"), createSubCategory);

/**
 * Admin – Get all subcategories
 */
router.get("/", getAllSubCategories);

/**
 * Admin – Update subcategory
 */
router.put("/:id", upload.single("image"), updateSubCategory);

/**
 * Admin – Delete subcategory
 */
router.delete("/:id", deleteSubCategory);

/**
 * Client – Get subcategories of a category
 */
router.get("/category/:categoryId", getSubCategoriesByCategory);

module.exports = router;
