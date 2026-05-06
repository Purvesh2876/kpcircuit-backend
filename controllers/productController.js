// productController.js
const Category = require('../models/categoryModel');
const Product = require('../models/productModel');
const fs = require('fs');
const path = require('path');
const subcategoryModel = require('../models/subcategoryModel');
const mongoose = require("mongoose");

const { generateSKU } = require("../utils/skuGenerator");
const InventoryLog = require('../models/inventoryLogModel');

// exports.createProduct = async (req, res) => {
//     try {
//         const {
//             name,
//             category,
//             subCategory,
//             description,
//             manufacturer,
//             price,
//             stock,
//             featured,
//         } = req.body;
//         console.log('get data from frontend', name, category, description, manufacturer, price, stock, featured, subCategory);
//         // 🔥 Create initial stock log
//         if (stock && Number(stock) > 0) {
//             await InventoryLog.create({
//                 product: product._id,
//                 type: "IN",
//                 quantity: Number(stock),
//                 reason: "INITIAL",
//                 note: "Initial stock added during product creation",
//                 createdBy: req.user?.email || "admin",
//             });
//         }

//         const cat = await Category.findById(category);
//         const sub = await subcategoryModel.findById(subCategory);

//         if (!cat || !sub) {
//             return res.status(400).json({ message: "Invalid category or subcategory" });
//         }

//         const sku = await generateSKU(cat.name, sub.name);

//         const imagesPath = req.files
//             ? req.files.map(file => `/products/${name}/${file.filename}`)
//             : [];

//         const product = await Product.create({
//             name,
//             sku,
//             category,
//             subCategory,
//             description,
//             manufacturer,
//             price,
//             stock,
//             images: imagesPath,
//             featured,
//         });

//         res.status(201).json(product);
//     } catch (error) {
//         res.status(400).json({ message: error.message });
//     }
// };

// exports.getAllProducts = async (req, res) => {
//     try {
//         const {
//             category,
//             subCategory,
//             search,
//             sort = "newest",
//             page = 1,
//             limit = 10,
//         } = req.query;

//         let filter = { isActive: true };

//         // Category filter
//         if (category) {
//             filter.category = category;
//         }

//         // SubCategory filter
//         if (subCategory) {
//             filter.subCategory = subCategory;
//         }

//         // Search (global or contextual)
//         if (search) {
//             filter.$or = [
//                 { name: new RegExp(search, "i") },
//                 { manufacturer: new RegExp(search, "i") },
//             ];
//         }

//         // Sorting
//         let sortQuery = { createdAt: -1 }; // newest default

//         if (sort === "price_asc") sortQuery = { price: 1 };
//         if (sort === "price_desc") sortQuery = { price: -1 };

//         const skip = (page - 1) * limit;

//         const products = await Product.find(filter)
//             .populate("category", "name")
//             .populate("subCategory", "name")
//             .sort(sortQuery)
//             .skip(skip)
//             .limit(Number(limit));

//         const totalProducts = await Product.countDocuments(filter);

//         res.status(200).json({
//             totalProducts,
//             currentPage: Number(page),
//             totalPages: Math.ceil(totalProducts / limit),
//             products,
//         });
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// };

exports.createProduct = async (req, res) => {
    try {
        const {
            name,
            category,
            subCategory,
            description,
            manufacturer,
            price,
            stock,
            featured,
        } = req.body;

        console.log('get data from frontend', name, category, description, manufacturer, price, stock, featured, subCategory);

        const cat = await Category.findById(category);
        const sub = await subcategoryModel.findById(subCategory);

        if (!cat || !sub) {
            return res.status(400).json({ message: "Invalid category or subcategory" });
        }

        const sku = await generateSKU(cat.name, sub.name);

        const imagesPath = req.files
            ? req.files.map(file => `/products/${name}/${file.filename}`)
            : [];

        // ✅ STEP 1: Create product first
        const product = await Product.create({
            name,
            sku,
            category,
            subCategory,
            description,
            manufacturer,
            price,
            stock,
            images: imagesPath,
            featured,
        });

        // ✅ STEP 2: Then create inventory log
        if (stock && Number(stock) > 0) {
            await InventoryLog.create({
                product: product._id,
                type: "IN",
                quantity: Number(stock),
                reason: "INITIAL",
                note: "Initial stock added during product creation",
                createdBy: req.user?.email || "admin",
            });
        }

        res.status(201).json(product);

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getInventoryLogs = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const skip = (Number(page) - 1) * Number(limit);

        const logs = await InventoryLog.find({ product: id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await InventoryLog.countDocuments({ product: id });

        res.status(200).json({
            success: true,
            page: Number(page),
            totalPages: Math.ceil(total / limit),
            totalLogs: total,
            logs
        });

    } catch (error) {
        console.error("Inventory Logs Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch inventory logs"
        });
    }
};
const { runInTransaction } = require('../utils/transactionHelper');

exports.addStock = async (req, res) => {
    try {
        const { quantity, note } = req.body;

        if (!quantity || Number(quantity) <= 0) {
            return res.status(400).json({ message: "Invalid quantity" });
        }

        const result = await runInTransaction(async (session) => {
            // ✅ Update stock atomically
            const updatedProduct = await Product.findByIdAndUpdate(
                req.params.id,
                { $inc: { stock: Number(quantity) } },
                { new: true, session }
            );

            if (!updatedProduct) {
                throw new Error("Product not found");
            }

            // ✅ Create inventory log
            await InventoryLog.create([{
                product: updatedProduct._id,
                type: "IN",
                quantity: Number(quantity),
                reason: "PURCHASE",
                note: note || "Stock added manually",
                createdBy: req.user?.email || "admin",
            }], { session });

            return updatedProduct;
        });

        res.status(200).json({
            message: "Stock added successfully",
            stock: result.stock,
        });

    } catch (error) {
        console.error(error);
        res.status(400).json({
            message: error.message || "Server error"
        });
    }
};

exports.getAllProducts = async (req, res) => {
    try {
        const {
            category,
            subCategory,
            search,
            sort = "newest",
            page = 1,
            minPrice,
            maxPrice,
            featured
        } = req.query;

        // ✅ Only default to 10 if limit is NOT provided
        const limitValue = req.query.limit ? Number(req.query.limit) : 10;

        // Safety: prevent invalid values
        const safeLimit = limitValue > 0 ? limitValue : 10;

        let filter = { isActive: true };

        if (category) filter.category = category;
        if (subCategory) filter.subCategory = subCategory;

        if (search) {
            filter.$or = [
                { name: new RegExp(search, "i") },
                { manufacturer: new RegExp(search, "i") },
            ];
        }

        // 🔥 PRICE FILTER
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }

        // 🔥 FEATURED FILTER
        if (featured === "true") {
            filter.featured = true;
        }

        let sortQuery = { createdAt: -1 };
        if (sort === "price_asc") sortQuery = { price: 1 };
        if (sort === "price_desc") sortQuery = { price: -1 };

        const skip = (Number(page) - 1) * safeLimit;

        const products = await Product.find(filter)
            .populate("category", "name")
            .populate("subCategory", "name")
            .sort(sortQuery)
            .skip(skip)
            .limit(safeLimit);

        const totalProducts = await Product.countDocuments(filter);

        res.status(200).json({
            totalProducts,
            currentPage: Number(page),
            totalPages: Math.ceil(totalProducts / safeLimit),
            products,
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.searchProducts = async (req, res) => {
    try {
        const { q } = req.query;
        console.log('q', q);
        if (!q || q.trim().length < 2) {
            return res.status(200).json({ products: [] });
        }

        const products = await Product.find({
            isActive: true,
            name: { $regex: q, $options: "i" }, // ✅ only name
        })
            .select("_id name price mainImage")
            .limit(4); // only 4
        console.log('products', products);
        res.status(200).json({ products });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET SINGLE PRODUCT
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate("category", "name")
            .populate("subCategory", "name");

        console.log('product', product);
        if (!product)
            return res.status(404).json({ message: "Product not found" });

        res.json(product);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const {
            name,
            category,
            description,
            tags,
            variants,
            existingImages,
            removedImages,
            featured,
            subCategory,
            manufacturer,
            price
        } = req.body; // ❌ stock removed

        // Check if the category exists
        if (category) {
            const categoryExists = await Category.findById(category);
            if (!categoryExists) {
                return res.status(404).json({ message: 'Category not found' });
            }
        }

        // Parse arrays from JSON strings if necessary
        const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        const parsedVariants = typeof variants === 'string' ? JSON.parse(variants) : variants;
        const parsedExistingImages = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
        const parsedRemovedImages = typeof removedImages === 'string' ? JSON.parse(removedImages) : removedImages;

        // ✅ stock removed from updateData
        const updateData = {
            name,
            category,
            subCategory,
            manufacturer,
            price,
            description,
            tags: parsedTags,
            variants: parsedVariants,
            featured: featured === 'true',
        };

        const existingProduct = await Product.findById(req.params.id);
        if (!existingProduct) return res.status(404).json({ message: 'Product not found' });

        // Remove specified images if any
        if (parsedRemovedImages && parsedRemovedImages.length > 0) {
            updateData.images = existingProduct.images.filter(image => !parsedRemovedImages.includes(image));

            parsedRemovedImages.forEach((image) => {
                const imagePath = path.join(__dirname, '../uploads', image);
                fs.access(imagePath, fs.constants.F_OK, (err) => {
                    if (!err) {
                        fs.unlink(imagePath, (unlinkErr) => {
                            if (unlinkErr) console.error(`Error deleting image: ${unlinkErr.message}`);
                        });
                    }
                });
            });
        } else {
            updateData.images = parsedExistingImages || existingProduct.images;
        }

        // Handle new image uploads
        if (req.files && req.files.length > 0) {
            const newImagesPath = req.files.map(file => `/products/${name}/${file.filename}`);
            updateData.images = [...updateData.images, ...newImagesPath];
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};


exports.getSimilarProducts = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).select('subCategory category');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Primary: same subcategory, exclude current product
        let similar = await Product.find({
            _id: { $ne: req.params.id },
            subCategory: product.subCategory,
            isActive: true,
        })
            .select('name price images')
            .limit(4);

        // Fallback: fill remaining slots from same category
        if (similar.length < 4) {
            const excludeIds = [req.params.id, ...similar.map(p => p._id)];
            const extra = await Product.find({
                _id: { $nin: excludeIds },
                category: product.category,
                isActive: true,
            })
                .select('name price images')
                .limit(4 - similar.length);

            similar = [...similar, ...extra];
        }

        res.status(200).json({ success: true, products: similar });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
    try {
        console.log('req.params.id', req.params.id);
        const product = await Product.findByIdAndDelete(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message });
    }
};

