const express = require("express");
var cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

// Store de PAGOS
const pagos = {};

//Initialize kafka
const { Kafka } = require("kafkajs");

require("dotenv").config();

console.log("user: ", process.env.username);
console.log("servers: ", process.env.servers);

const kafka = new Kafka({
    clientId: "my-app",
    brokers: [process.env.servers],
    authenticationTimeout: Number(process.env.timeout),
    ssl: true,
    sasl: {
        mechanism: "plain", // scram-sha-256 or scram-sha-512
        username: process.env.username,
        password: process.env.password,
    },
});

class Gateway {
    constructor(kafka) {
        this.kafka = kafka;
        this.producer = kafka.producer();
        this.consumer = kafka.consumer({ groupId: "test-group1" });
    }

    async connect() {
        return await Promise.all([
            this.producer.connect(),
            this.consumer.connect(),
        ]);
    }

    async iniciarPago(deuda) {
        await this.producer.send({
            topic: "TRX-operacion-init",
            messages: [{ value: JSON.stringify(deuda) }],
        });
    }

    async finalizarPago(
        topics = ["TRX-operacion-auth", "TRX-operacion-reject"],
    ) {
        await this.consumer.subscribe({ topics: topics, fromBeginning: true });

        return await this.consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const pago = JSON.parse(message.value.toString());
                console.log(
                    "finalizarPago",
                    JSON.parse(message.value.toString())
                );
                try {
                    pagos[pago.id](pago);
                } catch (error) {
                    console.error("Error: ", error);
                }
            },
        });
    }
}

const gateway = new Gateway(kafka);

const procesarRespuestaPago = async ({ id, callback }) => {
    pagos[id] = callback;
};

//Create routes
app.post("/pago/:id", async (req, res) => {
    console.log("inicia pago => ", req.body);
    await gateway.iniciarPago({
        id: req.body.id,
        idTerminal: req.body.idTerminal,
        importe: req.body.importe,
    });
    console.warn("espera respuesta");
    await procesarRespuestaPago({
        id: req.body.id,
        callback: (response) => {
            res.json(response);
        },
    });
});

//Initialie express server
app.listen(port, async () => {
    await gateway.connect();
    await gateway.finalizarPago();
    console.log(`Example app listening at http://localhost:${port}`);
});
