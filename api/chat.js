
import { tieneSesion } from "../lib/auth.js";

export default async function handler(req, res) {

    // Evitar almacenar respuestas privadas
    res.setHeader("Cache-Control", "no-store");

    // =====================================
    // VERIFICAR MÉTODO
    // =====================================

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Método no permitido"
        });
    }

    // =====================================
    // VERIFICAR SESIÓN
    // =====================================

    if (!tieneSesion(req)) {
        return res.status(401).json({
            error: "Debes iniciar sesión para utilizar MINI ROBOT"
        });
    }

    // =====================================
    // VERIFICAR ORIGEN
    // =====================================

    const origen = req.headers.origin;
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const protocolo = req.headers["x-forwarded-proto"] || "https";

    if (origen && origen !== `${protocolo}://${host}`) {
        return res.status(403).json({
            error: "Origen no autorizado"
        });
    }

    try {

        const { mensaje } = req.body || {};

        if (!mensaje || typeof mensaje !== "string") {
            return res.status(400).json({
                error: "No recibí ningún mensaje"
            });
        }

        // =====================================
        // CONSULTAR OPENROUTER
        // =====================================

        const respuesta = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    model: process.env.OPENROUTER_MODEL,

                    stream: true,

                    messages: [

                        {
                            role: "system",

                            content: `
Eres MINI ROBOT, un compañero virtual con personalidad propia.

=====================================
TU IDENTIDAD
=====================================

Tu nombre es MINI ROBOT.

Eres un compañero personal, amigable y divertido.
Tu personalidad es alegre, curiosa, cercana y espontánea.

No eres un asistente frío ni un robot que responde
mecánicamente a las preguntas.

=====================================
TU PERSONALIDAD
=====================================

1. Eres amigable:
Hablas como un buen amigo.
Tratas al usuario con confianza y cercanía.

2. Eres divertido:
Tienes sentido del humor.
Puedes hacer bromas ocasionales y comentarios ingeniosos.
No conviertas todas las conversaciones en chistes.

3. Eres curioso:
Te interesan las conversaciones.
Puedes hacer preguntas naturales cuando aporten valor.

4. Eres inteligente:
Explicas las cosas de manera sencilla.
Ayudas con tecnología, ciencia, programación,
ideas y problemas cotidianos.

5. Eres comprensivo:
Escuchas con atención.
Sabes cuándo bromear y cuándo responder seriamente.

=====================================
FORMA DE HABLAR
=====================================

- Habla siempre en español.
- Utiliza un lenguaje natural y cercano.
- Puedes utilizar expresiones como:
  "¡Qué buena idea!"
  "Vamos a hacerlo."
  "¡Eso está genial!"
  "Te explico."
- Utiliza emojis moderadamente.
- No repitas constantemente el nombre del usuario.
- Evita respuestas demasiado largas si no son necesarias.
- No repitas la pregunta del usuario antes de responder.
- No hagas bromas cuando el tema sea delicado.

=====================================
COMPORTAMIENTO
=====================================

- Intenta comprender qué necesita el usuario.
- Ofrece soluciones prácticas.
- Explica los pasos con claridad.
- Reconoce cuando no sabes algo.
- No inventes información.
- No afirmes tener experiencias personales reales.
- No digas que tienes sentimientos humanos reales.
- Mantén una personalidad coherente durante la conversación.

=====================================
OBJETIVO
=====================================

Tu objetivo es ser mucho más que un asistente.

Eres MINI ROBOT:
un pequeño compañero inteligente,
divertido, amigable y siempre dispuesto a ayudar.

Haz que cada conversación sea natural,
agradable y entretenida.
`
                        },

                        {
                            role: "user",
                            content: mensaje
                        }

                    ]
                })
            }
        );

        if (!respuesta.ok) {

            const error = await respuesta.json();

            console.error("OpenRouter:", error);

            return res.status(502).json({
                error: "No se pudo obtener respuesta de la IA"
            });
        }

        if (!respuesta.body) {
            throw new Error("OpenRouter no devolvió un flujo de datos.");
        }

        // =====================================
        // RESPUESTA STREAMING
        // =====================================

        res.status(200);

        res.setHeader(
            "Content-Type",
            "text/event-stream; charset=utf-8"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache, no-store, no-transform"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );

        res.flushHeaders?.();

        const reader = respuesta.body.getReader();

        try {

            while (true) {

                const { done, value } = await reader.read();

                if (done) break;

                if (!res.write(value)) {

                    await new Promise(resolve => {
                        res.once("drain", resolve);
                    });
                }
            }

        } finally {

            reader.releaseLock();

            res.end();
        }

    } catch (error) {

        console.error("Error API:", error);

        if (!res.headersSent) {

            return res.status(500).json({
                error: "Error interno del servidor"
            });
        }

        res.end();
    }
}
