const { startProcess } = require("./load-test-common");

const serverA = startProcess("npm", ["run", "dev"], {
  PORT: "5000",
  SERVER_INSTANCE_ID: "server-A"
});
const serverB = startProcess("npm", ["run", "dev"], {
  PORT: "5001",
  SERVER_INSTANCE_ID: "server-B"
});

function shutdown() {
  serverA.kill();
  serverB.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

serverA.on("exit", (code) => {
  if (code && code !== 0) {
    process.exitCode = code;
  }
});

serverB.on("exit", (code) => {
  if (code && code !== 0) {
    process.exitCode = code;
  }
});
