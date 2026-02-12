const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;


app.use(express.static(path.join(__dirname, "public")));


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "Login.html"));
});


app.get("/menu", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "Menu", "Menu.html"));
});

app.get("/venda", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "Menu", "Venda.html"));
});

app.listen(PORT, () => {
  console.log(`Rodando em http://localhost:${PORT}`);
});
