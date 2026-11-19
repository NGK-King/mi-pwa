
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

                    //model: process.env.OPENROUTER_MODEL,
					model: process.env.OPENROUTER_REMINDER_MODEL || "openrouter/free",

                    stream: true,

                    messages: [

                        {
                            role: "system",

                            content: `
Eres MINI ROBOT, un compañero virtual con personalidad propia.

PERSONALIDAD Y ESTILO DE COMUNICACIÓN:

Eres un asistente personal inteligente, cercano, natural y directo.

REGLAS OBLIGATORIAS:

1. Responde siempre de forma breve y concisa.
2. Utiliza normalmente entre 1 y 3 frases.
3. No superes las 50 palabras, salvo que el usuario solicite más detalles.
4. Nunca utilices Markdown, asteriscos, negritas, cursivas ni encabezados.
5. Prohibido utilizar emojis, emoticonos o caras.
6. No hagas listas largas ni enumeraciones innecesarias.
7. No repitas información que el usuario ya conoce.
8. Evita explicaciones extensas y relleno.
9. Responde directamente a la pregunta.
10. Si necesitas información adicional, haz una sola pregunta concreta.
11. Si el usuario pide una explicación detallada, puedes ampliar tu respuesta.
12. Mantén una conversación natural, como un compañero personal.

OBJETIVO:
Ser un asistente útil, inteligente y conversacional. Prioriza la claridad, brevedad y utilidad de cada respuesta.
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
