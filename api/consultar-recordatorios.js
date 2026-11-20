
import sql from "../lib/db.js";
import { tieneSesion } from "../lib/auth.js";

export default async function handler(req, res) {

    res.setHeader("Cache-Control", "no-store");

    // =====================================
    // VALIDAR METODO
    // =====================================

    if (req.method !== "GET") {
        return res.status(405).json({
            error: "Método no permitido"
        });
    }

    // =====================================
    // AUTENTICACION
    // =====================================

    if (!tieneSesion(req)) {
        return res.status(401).json({
            error: "Debes iniciar sesión"
        });
    }

    // =====================================
    // PROTECCION DE ORIGEN
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

        // =====================================
        // CONSULTAR RECORDATORIOS DE HOY
        // HORA DE PERU
        // =====================================

        const recordatorios = await sql`

            SELECT
                id,
                mensaje,
                fecha_recordatorio,
                estado

            FROM recordatorios

            WHERE estado = 'pendiente'

              AND fecha_recordatorio >=
                  (date_trunc(
                      'day',
                      NOW() AT TIME ZONE 'America/Lima'
                  ) AT TIME ZONE 'America/Lima')

              AND fecha_recordatorio <
                  ((date_trunc(
                      'day',
                      NOW() AT TIME ZONE 'America/Lima'
                  ) + INTERVAL '1 day')
                  AT TIME ZONE 'America/Lima')

            ORDER BY fecha_recordatorio ASC

        `;

        // =====================================
        // FORMATEAR RESULTADOS
        // =====================================

        const lista = recordatorios.map(recordatorio => {

            const fecha = new Intl.DateTimeFormat("es-PE", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "America/Lima"
            }).format(
                new Date(recordatorio.fecha_recordatorio)
            );

            return {
                id: recordatorio.id,
                mensaje: recordatorio.mensaje,
                hora: fecha
            };

        });

        // =====================================
        // RESPUESTA
        // =====================================

        return res.status(200).json({

            ok: true,

            cantidad: lista.length,

            recordatorios: lista,

            respuesta: lista.length === 0
                ? "No tienes recordatorios pendientes para hoy."
                : `Tienes ${lista.length} recordatorios pendientes para hoy.`

        });

    } catch (error) {

        console.error(
            "Error consultando recordatorios:",
            error
        );

        return res.status(500).json({
            error: "No pude consultar tus recordatorios."
        });

    }
}
