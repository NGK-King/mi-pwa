
import sql from "../lib/db.js";
import { tieneSesion } from "../lib/auth.js";

export default async function handler(req, res) {

    // Evitar almacenar información privada
    res.setHeader("Cache-Control", "no-store");

    // =====================================
    // AUTENTICACIÓN
    // =====================================

    const token = process.env.ROBOT_API_TOKEN;
    const recibido = req.headers.authorization;

    const accesoESP32 =
        Boolean(token) &&
        recibido === `Bearer ${token}`;

    const accesoWeb = tieneSesion(req);

    if (!accesoESP32 && !accesoWeb) {
        return res.status(401).json({
            error: "Acceso no autorizado"
        });
    }

    // =====================================
    // PROTECCIÓN CONTRA PETICIONES EXTERNAS
    // =====================================

    if (accesoWeb && !accesoESP32 && req.method !== "GET") {

        const origen = req.headers.origin;

        const host =
            req.headers["x-forwarded-host"] ||
            req.headers.host;

        const protocolo =
            req.headers["x-forwarded-proto"] ||
            "https";

        if (origen && origen !== `${protocolo}://${host}`) {
            return res.status(403).json({
                error: "Origen no autorizado"
            });
        }
    }

    try {

        // =====================================
        // CONSULTAR RECORDATORIOS
        // =====================================

        if (req.method === "GET") {

            const recordatorios = await sql`
                SELECT
                    id,
                    tarea,
                    fecha_hora,
                    estado,
                    fecha_notificacion
                FROM recordatorios
                WHERE estado = 'pendiente'
                ORDER BY fecha_hora ASC
            `;

            return res.status(200).json({
                ok: true,
                recordatorios
            });
        }

        // =====================================
        // CREAR RECORDATORIO
        // =====================================

        if (req.method === "POST") {

            const { tarea, fecha_hora } = req.body || {};

            if (
                typeof tarea !== "string" ||
                !tarea.trim() ||
                tarea.trim().length > 500 ||
                typeof fecha_hora !== "string"
            ) {
                return res.status(400).json({
                    error: "Faltan la tarea o la fecha, o los datos no son válidos"
                });
            }

            const fecha = new Date(fecha_hora);

            if (Number.isNaN(fecha.getTime())) {
                return res.status(400).json({
                    error: "Fecha u hora no válida"
                });
            }

            const resultado = await sql`
                INSERT INTO recordatorios (
                    tarea,
                    fecha_hora,
                    zona_horaria,
                    estado
                )
                VALUES (
                    ${tarea.trim()},
                    ${fecha.toISOString()},
                    'America/Lima',
                    'pendiente'
                )
                RETURNING *
            `;

            return res.status(201).json({
                ok: true,
                mensaje: "Recordatorio guardado",
                recordatorio: resultado[0]
            });
        }

        // =====================================
        // COMPLETAR O CANCELAR
        // =====================================

        if (req.method === "PATCH") {

            const { id, estado } = req.body || {};

            if (
                !id ||
                !["completado", "cancelado"].includes(estado)
            ) {
                return res.status(400).json({
                    error: "Datos no válidos"
                });
            }

            const resultado = await sql`
                UPDATE recordatorios
                SET estado = ${estado}
                WHERE id = ${id}
                RETURNING *
            `;

            if (resultado.length === 0) {
                return res.status(404).json({
                    error: "Recordatorio no encontrado"
                });
            }

            return res.status(200).json({
                ok: true,
                mensaje: "Recordatorio actualizado",
                recordatorio: resultado[0]
            });
        }

        return res.status(405).json({
            error: "Método no permitido"
        });

    } catch (error) {

        console.error("Error en recordatorios:", error);

        return res.status(500).json({
            error: "Error al gestionar los recordatorios"
        });
    }
}
