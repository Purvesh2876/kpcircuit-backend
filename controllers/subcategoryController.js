const SubCategory = require("../models/subcategoryModel");

/**
 * ✅ Create SubCategory (Admin)
 */
exports.createSubCategory = async (req, res) => {
    try {
        const { name, category, description } = req.body;

        const image = req.file
            ? `/subcategory/${name}/${req.file.filename}`
            : null;

        const subCategory = await SubCategory.create({
            name,
            category,
            description,
            image,
        });

        res.status(201).json(subCategory);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * ✅ Get all SubCategories (optional – admin use)
 */
exports.getAllSubCategories = async (req, res) => {
    try {
        const subCategories = await SubCategory.find().populate(
            "category",
            "name"
        );
        res.status(200).json(subCategories);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * ✅ Get SubCategories by Category (IMPORTANT – frontend uses this)
 */
exports.getSubCategoriesByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const subCategories = await SubCategory.find({
            category: categoryId,
        });

        res.status(200).json(subCategories);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateSubCategory = async (req, res) => {
    try {
        const { name, category, description } = req.body;

        // 1. Create an object with the text data first
        let updateData = {
            name,
            category,
            description
        };

        // 2. Check if a new image was uploaded
        // If req.file exists, it means the user selected a new image to replace the old one
        if (req.file) {
            updateData.image = `/subcategory/${name}/${req.file.filename}`;
        }

        // 3. Update the database
        const updated = await SubCategory.findByIdAndUpdate(
            req.params.id,
            updateData, // Pass our custom object, NOT req.body
            { new: true }
        );

        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteSubCategory = async (req, res) => {
    try {
        await SubCategory.findByIdAndDelete(req.params.id);
        res.json({ message: "SubCategory deleted" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
