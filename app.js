const express = require("express");
const cors = require("cors");



const convertRoutes = require("./routes/convert.routes");
const buildRoutes = require("./routes/build.routes");

const errorMiddleware = require("./middleware/error.middleware");
const env = require("./config/env");

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    methods: [
      "GET",
      "POST",
      "OPTIONS",
    ],
  })
);

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

app.get("/",(req,res)=>{
    res.json({
        success:true,
        message:"Backend is running"
    })
})

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Website-to-App backend is running.",
    timestamp: new Date().toISOString(),
  });
});

app.use(
  "/api/convert",
  convertRoutes
);

app.use(
  "/api/builds",
  buildRoutes
);

app.use(errorMiddleware);

module.exports = app;