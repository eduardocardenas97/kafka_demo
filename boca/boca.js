const { Kafka } = require("kafkajs");

require("dotenv").config();
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


class Boca {
    constructor(kafka) {
        this.kafka = kafka;
        this.producer = kafka.producer();
        this.consumer = kafka.consumer({ groupId: "test-group4" });
    }

    async connect() {
        return await Promise.all([this.producer.connect(), this.consumer.connect()]);
    }

    async send(topic, message) {
        return this.producer.send({
            topic: topic,
            messages: [{ value: message }],
        });
    }

    async pagoDirecto(deuda) {
        const topic = "TRX-boca-auth";
        //deserialize deuda to json
        const pago = JSON.parse(deuda);
        pago.auth = true;
        console.log(`Enviando autorizacion => ${JSON.stringify(pago)} \n`);
        return await this.send(topic, JSON.stringify(pago));
    }

    async procesarDatosPago(topic='TRX-operacion-init', message) {
        await this.consumer.subscribe({ topic: topic, fromBeginning: true });
        return await this.consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                console.log(" -------------- ");
                console.info("Pago recibido <= ");
                console.log({
                    topic: topic,
                    value: message.value.toString(),
                });
                await this.pagoDirecto(message.value.toString());
                console.log(" -------------- ");
            }
        });
    }

    async disconnect() {
        return this.producer.disconnect();
    }
}


async function main() {
    const boca = new Boca(kafka);
    await boca.connect();
    await boca.procesarDatosPago();
}

main()