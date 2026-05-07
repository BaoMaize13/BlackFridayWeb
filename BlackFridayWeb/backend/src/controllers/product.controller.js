const { HTTP_STATUS } = require("../constants/system");
const productService = require("../services/product.service");
const { sendSuccess } = require("../utils/response");
const { validateProductIdParam, validateResetStockBody } = require("../validators/product.validator");

async function listProducts(req, res) {
  const products = await productService.listProducts();

  return sendSuccess(res, req, {
    message: "Products retrieved successfully",
    data: products,
    meta: {
      totalItems: products.length
    }
  });
}

async function getProductById(req, res) {
  const productId = validateProductIdParam(req.params.id || req.params.productId);
  const product = await productService.getProductById(productId);

  return sendSuccess(res, req, {
    message: "Product retrieved successfully",
    data: product
  });
}

async function resetProductStock(req, res) {
  const productId = validateProductIdParam(req.params.id || req.params.productId);
  const payload = validateResetStockBody(req.body);
  const result = await productService.resetProductStock(productId, payload, {
    logger: req.context?.logger
  });

  return sendSuccess(res, req, {
    message: "Product stock reset successfully",
    data: result,
    statusCode: HTTP_STATUS.OK
  });
}

async function resetAllProducts(req, res) {
  const payload = validateResetStockBody(req.body);
  const result = await productService.resetAllProducts(payload, {
    logger: req.context?.logger
  });

  return sendSuccess(res, req, {
    message: "All products reset successfully",
    data: result,
    statusCode: HTTP_STATUS.OK
  });
}

module.exports = {
  getProductById,
  listProducts,
  resetAllProducts,
  resetProductStock
};
