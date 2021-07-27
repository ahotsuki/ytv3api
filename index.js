require("dotenv").config();
const fileupload = require("express-fileupload");
const path = require("path");
const express = require("express");
const app = express();
const ytapiRouter = require("./ytapi");
const cors = require("cors");

app.use(cors());
app.use(express.json());
app.use(
  fileupload({
    useTempFiles: true,
    tempFileDir: path.join(__dirname, "tmp"),
  })
);
app.use(express.static("./node_modules/"));

app.get("/", (req, res) => {
  res.send(`
    <a href="/ytapi">Start app</a>
  `);
});
app.use("/ytapi", ytapiRouter);

const PORT = process.env.YTAPI_PORT;
app.listen(PORT, () => {
  console.log(`Listening to port ${PORT}...`);
});
