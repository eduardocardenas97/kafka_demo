require("dotenv").config();
const { Kafka } = require("kafkajs");
const { CompressionTypes, CompressionCodecs } = require("kafkajs");
const SnappyCodec = require("kafkajs-snappy");
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

const kafka = new Kafka({
    clientId: "my-app",
    brokers: [process.env.servers],
    ssl: true,
    sasl: {
        mechanism: "plain", // scram-sha-256 or scram-sha-512
        username: process.env.username,
        password: process.env.password,
    },
});

class Facturador {
    constructor(kafka) {
        this.kafka = kafka;
        this.producer = kafka.producer();
        this.consumer = kafka.consumer({ groupId: "test-group3" });
    }

    async connect() {
        return await Promise.all([
            this.producer.connect(),
            this.consumer.connect(),
        ]);
    }

    async enviarConfirmacion(message) {
        const topic = "TRX-facturador-auth";
        message = JSON.parse(message);

        const random = Math.floor(Math.random() * 100);

        if (message.importe > 0) {
            message.cvc = random;
            message.auth = true;
        } else {
            message.cvc = "---";
            message.auth = false;
        }
        
        console.warn(`Enviando comprobacion => ${JSON.stringify(message)} \n`);
        return this.producer.send({
            topic: topic,
            messages: [{ value: JSON.stringify(message) }],
        });
    }

    async autorizarPago(topic = "TRX-operacion-init") {
        await this.consumer.subscribe({ topic: topic, fromBeginning: true });

        return await this.consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                console.log(" -------------- ");
                console.info("Evaluando pago <= ");
                console.log({
                    topic: topic,
                    value: message.value.toString(),
                });
                await this.enviarConfirmacion(message.value.toString());
                console.log(" -------------- ");
            },
        });
    }
}

async function main() {
    const facturador = new Facturador(kafka);
    await facturador.connect();
    await facturador.autorizarPago();
}

main();
