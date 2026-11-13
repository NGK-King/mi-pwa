
export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Método no permitido"
        });
    }

    try {

        const { mensaje } = req.body || {};

        if (!mensaje || typeof mensaje !== "string") {
            return res.status(400).json({
                error: "No recibí ningún mensaje"
            });
        }

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
                            content: `Eres MINI ROBOT, un asistente virtual amigable.
Hablas siempre en español.
Respondes de forma natural, clara y breve.
Ayudas con tecnología, ciencia, programación
y conversaciones generales.
No inventes información.
Utiliza respuestas concisas y fáciles de entender.`
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

        res.status(200);

        res.setHeader(
            "Content-Type",
            "text/event-stream; charset=utf-8"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache, no-transform"
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
