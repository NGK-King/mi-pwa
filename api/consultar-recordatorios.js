
import sql from "../lib/db.js";
import { tieneSesion } from "../lib/auth.js";

export default async function handler(req, res) {

    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET") {
        return res.status(405).json({
            error: "Método no permitido"
        });
    }

    if (!tieneSesion(req)) {
        return res.status(401).json({
            error: "Debes iniciar sesión"
        });
    }

    // PROTECCION DE ORIGEN

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
        // DETERMINAR DIA DE CONSULTA
        // =====================================

        const dia = req.query?.dia || "hoy";

        if (dia !== "hoy" && dia !== "manana") {
            return res.status(400).json({
                error: "Día no válido. Utiliza hoy o manana."
            });
        }

        const desplazamiento = dia === "manana" ? 1 : 0;

        // =====================================
        // CALCULAR LIMITES EN HORA DE PERU
        // =====================================

        const limites = await sql`
            SELECT

                (
                    (
                        date_trunc(
                            'day',
                            NOW() AT TIME ZONE 'America/Lima'
                        )
                        + ${desplazamiento} * INTERVAL '1 day'
                    )
                    AT TIME ZONE 'America/Lima'
                ) AS inicio,

                (
                    (
                        date_trunc(
                            'day',
                            NOW() AT TIME ZONE 'America/Lima'
                        )
                        + (${desplazamiento} + 1) * INTERVAL '1 day'
                    )
                    AT TIME ZONE 'America/Lima'
                ) AS fin
        `;

        // =====================================
        // CONSULTAR RECORDATORIOS
        // =====================================

        const recordatorios = await sql`

            SELECT
                id,
                mensaje,
                fecha_recordatorio,
                estado

            FROM recordatorios

            WHERE estado = 'pendiente'

              AND fecha_recordatorio >= ${limites[0].inicio}

              AND fecha_recordatorio < ${limites[0].fin}

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

        const nombreDia = dia === "hoy" ? "hoy" : "mañana";

        return res.status(200).json({

            ok: true,
            dia: dia,
            cantidad: lista.length,
            recordatorios: lista,

            respuesta: lista.length === 0
                ? `No tienes recordatorios pendientes para ${nombreDia}.`
                : `Tienes ${lista.length} recordatorios pendientes para ${nombreDia}.`

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
