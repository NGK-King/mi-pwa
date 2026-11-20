
import sql from "../lib/db.js";
import { tieneSesion } from "../lib/auth.js";

export default async function handler(req, res) {

    res.setHeader("Cache-Control", "no-store");

    // =====================================
    // VALIDAR METODO
    // =====================================

    if (req.method !== "POST") {
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
        // RECIBIR IDENTIFICADOR
        // =====================================

        const { id } = req.body || {};

        const idNumero = Number(id);

        if (
            !Number.isSafeInteger(idNumero) ||
            idNumero <= 0
        ) {
            return res.status(400).json({
                ok: false,
                error: "Identificador de recordatorio no válido."
            });
        }

        // =====================================
        // CANCELAR RECORDATORIO
        // =====================================

        const resultado = await sql`

            UPDATE recordatorios

            SET estado = 'cancelado'

            WHERE id = ${idNumero}
              AND estado = 'pendiente'

            RETURNING
                id,
                mensaje,
                estado,
                fecha_recordatorio

        `;

        // =====================================
        // VERIFICAR RESULTADO
        // =====================================

        if (resultado.length === 0) {

            const existente = await sql`
                SELECT id, estado
                FROM recordatorios
                WHERE id = ${idNumero}
                LIMIT 1
            `;

            if (existente.length === 0) {
                return res.status(404).json({
                    ok: false,
                    error: "No encontré ese recordatorio."
                });
            }

            return res.status(409).json({
                ok: false,
                error: "Este recordatorio ya no está pendiente.",
                estado: existente[0].estado
            });
        }

        // =====================================
        // CONFIRMAR CANCELACION
        // =====================================

        const recordatorio = resultado[0];

        return res.status(200).json({

            ok: true,

            accion: "cancelado",

            respuesta:
                `He cancelado tu recordatorio: ${recordatorio.mensaje}.`,

            recordatorio

        });

    } catch (error) {

        console.error(
            "Error cancelando recordatorio:",
            error
        );

        return res.status(500).json({
            ok: false,
            error: "No pude cancelar el recordatorio."
        });
    }
}
