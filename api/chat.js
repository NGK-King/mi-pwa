
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
                    messages: [
                        {
                            role: "system",
                            content: `Eres MINI ROBOT, un asistente virtual amigable.
Hablas siempre en español.
Respondes de forma natural, clara y breve.
Ayudas con tecnología, ciencia, programación
y conversaciones generales.
No inventes información.`
                        },
                        {
                            role: "user",
                            content: mensaje
                        }
                    ]
                })
            }
        );

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            console.error("OpenRouter:", datos);
            return res.status(502).json({
                error: "No se pudo obtener respuesta de la IA"
            });
        }

        return res.status(200).json({
            respuesta: datos.choices?.[0]?.message?.content
                || "No pude generar una respuesta."
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Error interno del servidor"
        });
    }
}
