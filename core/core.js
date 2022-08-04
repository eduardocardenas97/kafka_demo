const { Kafka } = require("kafkajs");
const SnappyCodec = require("kafkajs-snappy");
const { CompressionTypes, CompressionCodecs } = require("kafkajs");

CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;
require("dotenv").config();
const kafka = new Kafka({
    clientId: "my-app2",
    brokers: [process.env.servers],
    ssl: true,
    sasl: {
        mechanism: "plain", // scram-sha-256 or scram-sha-512
        username: process.env.username,
        password: process.env.password,
    },
});

const redis = require("redis");
const client = redis.createClient(); //creates a new client

class TRX_core {
    constructor(kafka, redisClient) {
        this.kafka = kafka;
        this.producer = kafka.producer();
        this.consumer = kafka.consumer({ groupId: "test-group2" });
        this.redisClient = redisClient;
    }

    async connect() {
        return await Promise.all([
            this.producer.connect(),
            this.consumer.connect(),
            this.redisClient.connect(),
        ]);
    }

    //El TRX_core realiza la autorización de los pagos
    //Envia un evento de autorización al Kafka con el mensaje de la deuda
    async autorizar(peticion) {
        //Peticion contiene los datos de la deuda
        //Si la deuda es mayor a cero, se autoriza el pago
        //Si la deuda es menor a cero, se rechaza el pago
        const pago = JSON.parse(peticion);
        console.log(" -------------- ");
        console.log(pago);
        await this.guardarPago(peticion);
        if (pago.importe > 0) {
            //Agreagar la fecha actual al pago
            pago.fecha = new Date();
            await this.producer.send({
                topic: "TRX-operacion-auth",
                messages: [{ value: JSON.stringify(pago) }],
            });
            console.log(" => Autorizado");
            console.log(" -------------- ");
            return true;
        } else {
            pago.rechazo = "Datos invalidos";
            pago.cvc = "----- No generado -----";
            await this.producer.send({
                topic: "TRX-operacion-reject",
                messages: [{ value: JSON.stringify(pago) }],
            });
            console.log(" <= Rechazado");
            console.log(" -------------- ");
            return false;
        }
    }

    //El autorizador recibe los mensajes de autorización del Kafka
    async procesarAutorizacion(
        topic = "pksqlc-jzvwpTRX_autorizacion",
        message
    ) {
        //El autorizador procesa el mensaje de la deuda
        //El autorizador es un consumer de Kafka
        await this.consumer.subscribe({ topic: topic, fromBeginning: true });

        return await this.consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                console.log("\n => Procesando autorización");
                console.log({
                    topic: topic,
                    value: message.value.toString(),
                });
                await this.autorizar(message.value.toString());
            },
        });
    }

    //Guardar los pagos procesados en Redis
    async guardarPago(pago) {
        try {
            const id = JSON.parse(pago).id.toString();
            await this.redisClient.set(id, pago);
            console.log(" => Guardado en Redis");
        } catch (error) {
            console.error("Error de redis: " + error);
        }
    }
}

async function main() {
    const core = new TRX_core(kafka, client);
    await core.connect();
    await core.procesarAutorizacion();
}

main();
