const { HTTP_STATUS } = require("../constants/system");
const adminProductService = require("../services/admin-product.service");
const { sendSuccess } = require("../utils/response");
const {
  validateCreateProductBody,
  validateListProductsQuery,
  validateProductIdParam,
  validateResetProductBody,
  validateUpdateProductStockBody
} = require("../validators/admin.validator");

async function createProduct(req, res) {
  const payload = validateCreateProductBody(req.body);
  const product = await adminProductService.createProduct(payload, {
    logger: req.context?.logger
  });

  return sendSuccess(res, req, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Product created successfully",
    data: product
  });
}

async function listProducts(req, res) {
  const filter = validateListProductsQuery(req.query);
  const products = await adminProductService.listProducts(filter);

  return sendSuccess(res, req, {
    message: "Products retrieved successfully",
    data: products,
    meta: {
      totalItems: products.length
    }
  });
}

async function getProductById(req, res) {
  const productId = validateProductIdParam(req.params.productId);
  const product = await adminProductService.getProductById(productId);

  return sendSuccess(res, req, {
    message: "Product retrieved successfully",
    data: product
  });
}

async function updateProductStock(req, res) {
  const productId = validateProductIdParam(req.params.productId);
  const payload = validateUpdateProductStockBody(req.body);
  const product = await adminProductService.updateProductStock(productId, payload.stock, {
    logger: req.context?.logger
  });

  return sendSuccess(res, req, {
    message: "Product stock updated successfully",
    data: product
  });
}

async function resetProductData(req, res) {
  const productId = validateProductIdParam(req.params.productId);
  const payload = validateResetProductBody(req.body);
  const result = await adminProductService.resetProductData(productId, payload, {
    logger: req.context?.logger
  });

  return sendSuccess(res, req, {
    message: "Product demo data reset successfully",
    data: result
  });
}

module.exports = {
  createProduct,
  getProductById,
  listProducts,
  resetProductData,
  updateProductStock
};
