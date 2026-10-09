const app = require("./app");
const env = require("./config/env");

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log("");
  console.log("========================================");
  console.log(" WEBSITE → APP BACKEND");
  console.log("========================================");
  console.log(`Server : http://localhost:${PORT}`);
  console.log(
    `Health : http://localhost:${PORT}/api/health`
  );
  console.log(
    `Build Engine : ${env.BUILD_ENGINE_ROOT}`
  );
  console.log("========================================");
  console.log("");
});