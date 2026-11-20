import sql from "../lib/db.js";
import { enviarTelegram } from "../lib/telegram.js";

export default async function handler(req, res) {

    res.setHeader("Cache-Control", "no-store");

    // =====================================
    // PROTEGER EL CRON
    // =====================================

    if (req.method !== "GET") {
        return res.status(405).json({
            error: "Método no permitido"
        });
    }

    const secreto = process.env.CRON_SECRET;
    const recibido = req.headers.authorization;

    if (!secreto || recibido !== `Bearer ${secreto}`) {
        return res.status(401).json({
            error: "Acceso no autorizado"
        });
    }

    try {

        // =====================================
        // BUSCAR RECORDATORIOS VENCIDOS
        // =====================================

        const pendientes = await sql`
            SELECT
                id,
                mensaje,
                fecha_recordatorio
            FROM recordatorios
            WHERE estado = 'pendiente'
              AND fecha_recordatorio <= NOW()
              AND fecha_notificacion IS NULL
            ORDER BY fecha_recordatorio ASC
            LIMIT 20
        `;

        let enviados = 0;
        const errores = [];

        // =====================================
        // ENVIAR AVISOS POR TELEGRAM
        // =====================================

        for (const recordatorio of pendientes) {

            try {

                const fecha = new Intl.DateTimeFormat("es-PE", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Lima"
                }).format(new Date(recordatorio.fecha_recordatorio));

                const mensajeTelegram =
                    `🤖 MINI ROBOT\n\n` +
                    `⏰ ¡Es hora de tu recordatorio!\n\n` +
                    `📝 ${recordatorio.mensaje}\n\n` +
                    `📅 ${fecha}`;

                await enviarTelegram(mensajeTelegram);


				// Marcar como notificado solamente
				// después de enviar correctamente a Telegram.

				await sql`
					UPDATE recordatorios
					SET
						estado = 'notificado',
						fecha_notificacion = NOW()
					WHERE id = ${recordatorio.id}
					  AND estado = 'pendiente'
					  AND fecha_notificacion IS NULL
				`;


                enviados++;

            } catch (error) {

                console.error(
                    "Error enviando recordatorio:",
                    recordatorio.id,
                    error
                );

                errores.push(String(recordatorio.id));
            }
        }

        return res.status(200).json({
            ok: errores.length === 0,
            encontrados: pendientes.length,
            enviados,
            errores
        });

    } catch (error) {

        console.error("Error en cron-recordatorios:", error);

        return res.status(500).json({
            error: "Error al procesar los recordatorios"
        });
    }
}