const path = require("node:path");

const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(process.cwd(), ".env.test"),
  override: false,
  quiet: true
});
