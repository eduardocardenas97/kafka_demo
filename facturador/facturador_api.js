//Create api with one endpoint:
// post /pago/:id/:importe
// use express

const express = require("express");
var cors = require("cors");
const app = express();
app.use(cors());

app.post("/pago/:id/:importe", async (req, res) => {
    console.log("inicia pago");
    //if importe is greater than 1000, set timeout to 1 second
    if (req.params.importe > 1000) {
        setTimeout(() => {
            res.json({
                id: req.params.id,
                importe: req.params.importe,
                detalle: "Pago procesado - 1s",
            });
        }, 1000);
    } else {
        id: req.params.id,
        res.json({
            importe: req.params.importe,
            detalle: "Pago procesado",
        });
    }
    console.log("pago procesado");
});

app.listen(2070, () => {
    console.log("Server is running on port 2070");
});