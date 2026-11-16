
import sql from "../lib/db.js";
import { tieneSesion } from "../lib/auth.js";

export default async function handler(req, res) {

    res.setHeader("Cache-Control", "no-store");

    // =====================================
    // AUTENTICACION
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
    // PROTECCION DE ORIGEN
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
                    mensaje,
                    fecha_recordatorio,
                    estado,
                    fecha_creacion
                FROM recordatorios
                WHERE estado = 'pendiente'
                ORDER BY fecha_recordatorio ASC
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

            const { mensaje, fecha_recordatorio } = req.body || {};

            if (
                typeof mensaje !== "string" ||
                !mensaje.trim() ||
                mensaje.trim().length > 500 ||
                typeof fecha_recordatorio !== "string"
            ) {
                return res.status(400).json({
                    error: "Datos del recordatorio no válidos"
                });
            }

            const fecha = new Date(fecha_recordatorio);

            if (
                Number.isNaN(fecha.getTime()) ||
                fecha.getTime() <= Date.now()
            ) {
                return res.status(400).json({
                    error: "La fecha debe ser válida y futura"
                });
            }

            const resultado = await sql`
                INSERT INTO recordatorios (
                    mensaje,
                    fecha_recordatorio,
                    estado
                )
                VALUES (
                    ${mensaje.trim()},
                    ${fecha.toISOString()},
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
        // ACTUALIZAR RECORDATORIO
        // =====================================

        if (req.method === "PATCH") {

            const { id, estado } = req.body || {};

            const idValido =
                (typeof id === "number" && Number.isSafeInteger(id) && id > 0) ||
                (typeof id === "string" && /^[1-9]\d*$/.test(id));

            if (!idValido) {
                return res.status(400).json({
                    error: "Identificador no válido"
                });
            }

            // COMPLETAR O CANCELAR

            if (!["completado", "cancelado"].includes(estado)) {
                return res.status(400).json({
                    error: "Estado no válido"
                });
            }

            const resultado = await sql`
                UPDATE recordatorios
                SET estado = ${estado}
                WHERE id = ${String(id)}
                  AND estado = 'pendiente'
                RETURNING *
            `;

            if (resultado.length === 0) {
                return res.status(404).json({
                    error: "Recordatorio no encontrado o ya actualizado"
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
