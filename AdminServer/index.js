const { createApp } = require("./src/app");
const { config } = require("./src/config");

const app = createApp();

app.listen(config.port, "0.0.0.0", () => {
  console.log(`Admin server listening on port ${config.port}`);
});
