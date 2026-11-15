
import { tieneSesion } from "../lib/auth.js";
import { enviarTelegram } from "../lib/telegram.js";

export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Método no permitido"
        });
    }

    if (!tieneSesion(req)) {
        return res.status(401).json({
            error: "Debes iniciar sesión"
        });
    }

    try {

        await enviarTelegram(
            "🤖 ¡Hola! MINI ROBOT está conectado correctamente.\n\nYa puedo enviarte recordatorios."
        );

        return res.status(200).json({
            ok: true,
            mensaje: "Telegram conectado correctamente"
        });

    } catch (error) {

        console.error("Error de prueba Telegram:", error);

        return res.status(500).json({
            error: "No se pudo enviar el mensaje de prueba"
        });
    }
}
