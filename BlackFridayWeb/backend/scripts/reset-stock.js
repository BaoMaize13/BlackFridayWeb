const { buildConfig, getProduct, resetStock } = require("./load-test-common");

async function main() {
  const config = buildConfig({
    initialStock: 1
  });

  await resetStock(config);
  const product = await getProduct(config);

  console.log(`Product ${product.id} (${product.code}) stock reset to ${product.stock}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
