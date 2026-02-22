const Product = require("../models/productModel");

function makeCode(text) {
    return text
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, "")
        .split(" ")
        .slice(0, 2)
        .join("");
}

exports.generateSKU = async (categoryName, subCategoryName) => {
    const categoryCode = makeCode(categoryName);
    const subCategoryCode = makeCode(subCategoryName);

    const regex = new RegExp(`^${categoryCode}-${subCategoryCode}-`);

    const lastProduct = await Product.findOne({ sku: regex })
        .sort({ createdAt: -1 })
        .select("sku");

    let nextNumber = 1;

    if (lastProduct?.sku) {
        const lastNum = parseInt(lastProduct.sku.split("-").pop(), 10);
        nextNumber = lastNum + 1;
    }

    return `${categoryCode}-${subCategoryCode}-${String(nextNumber).padStart(3, "0")}`;
};
