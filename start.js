const express = require('express');
const app = express();
const PORT = 5500;

app.use(express.static('Web-App'));

app.listen(PORT, () => console.log("Server is listening on port " + PORT));