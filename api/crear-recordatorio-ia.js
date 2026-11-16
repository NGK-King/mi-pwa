
import sql from "../lib/db.js";
import { tieneSesion } from "../lib/auth.js";

export default async function handler(req, res) {

    res.setHeader("Cache-Control", "no-store");

    // =====================================
    // AUTENTICACION
    // =====================================

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

        const { mensaje } = req.body || {};

        if (
            typeof mensaje !== "string" ||
            !mensaje.trim() ||
            mensaje.length > 1000
        ) {
            return res.status(400).json({
                error: "Mensaje no válido"
            });
        }

        // =====================================
        // OBTENER FECHA Y HORA DE PERU
        // =====================================

        const partes = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Lima",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23"
        }).formatToParts(new Date());

        const horaActual = {};

        for (const parte of partes) {
            horaActual[parte.type] = parte.value;
        }

        const ahoraLima =
            `${horaActual.year}-${horaActual.month}-${horaActual.day} ` +
            `${horaActual.hour}:${horaActual.minute}:${horaActual.second}`;

        // =====================================
        // CONSULTAR OPENROUTER
        // =====================================

        const respuestaIA = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    model: process.env.OPENROUTER_MODEL,

                    temperature: 0,

                    max_tokens: 350,

                    response_format: {
                        type: "json_object"
                    },

                    messages: [

                        {
                            role: "system",

                            content: `
Eres el sistema inteligente de recordatorios de MINI ROBOT.

Tu trabajo es interpretar solicitudes de recordatorios en español.

FECHA Y HORA ACTUAL:
${ahoraLima}

ZONA HORARIA:
America/Lima (UTC-05:00).

Devuelve exclusivamente un objeto JSON válido.

FORMATO:

{
  "accion": "crear",
  "mensaje": "Tarea que debe recordar",
  "fecha_recordatorio": "2026-11-17T08:00:00-05:00",
  "respuesta": "Confirmación amigable"
}

ACCIONES PERMITIDAS:

1. crear
2. aclarar
3. no_es_recordatorio

REGLAS:

- Interpreta expresiones como mañana, hoy, pasado mañana y días de la semana.
- Calcula las fechas tomando como referencia la fecha y hora de Perú indicadas arriba.
- Utiliza siempre el formato ISO con el desplazamiento -05:00.
- Nunca programes una fecha pasada.
- No inventes tareas.
- Conserva el significado original de la tarea.
- Si la hora es ambigua, pregunta si se refiere a mañana o noche.
- Si falta información indispensable, utiliza la acción aclarar.
- Si el mensaje no solicita un recordatorio, utiliza no_es_recordatorio.
- No afirmes que un recordatorio está guardado si todavía no se ha guardado.
- Habla de forma amigable, natural y breve.
- No incluyas Markdown ni explicaciones fuera del JSON.
`
                        },

                        {
                            role: "user",
                            content: mensaje.trim()
                        }

                    ]
                })
            }
        );

        if (!respuestaIA.ok) {

            const error = await respuestaIA.text();

            console.error("Error OpenRouter:", error);

            return res.status(502).json({
                error: "No se pudo interpretar el recordatorio"
            });
        }

        const datosIA = await respuestaIA.json();

        const contenido =
            datosIA.choices?.[0]?.message?.content;

        if (!contenido) {
            throw new Error("La IA no devolvió información.");
        }

        const interpretacion = JSON.parse(contenido);

        // =====================================
        // SOLICITAR ACLARACION
        // =====================================

        if (interpretacion.accion === "aclarar") {

            return res.status(200).json({
                ok: true,
                accion: "aclarar",
                respuesta: interpretacion.respuesta
            });
        }

        if (interpretacion.accion === "no_es_recordatorio") {

            return res.status(200).json({
                ok: true,
                accion: "no_es_recordatorio"
            });
        }

        // =====================================
        // VALIDAR DATOS
        // =====================================

        if (
            interpretacion.accion !== "crear" ||
            typeof interpretacion.mensaje !== "string" ||
            !interpretacion.mensaje.trim() ||
            typeof interpretacion.fecha_recordatorio !== "string"
        ) {
            throw new Error("La interpretación no es válida.");
        }

        const fechaTexto = interpretacion.fecha_recordatorio;

        // Exigir fecha con zona horaria de Perú.

        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/.test(fechaTexto)) {
            throw new Error("La fecha interpretada no tiene un formato válido.");
        }

        const fecha = new Date(fechaTexto);

        if (
            Number.isNaN(fecha.getTime()) ||
            fecha.getTime() <= Date.now()
        ) {
            return res.status(400).json({
                error: "La fecha interpretada no es futura. Inténtalo nuevamente."
            });
        }

        // =====================================
        // GUARDAR EN NEON
        // =====================================

        const resultado = await sql`
            INSERT INTO recordatorios (
                mensaje,
                fecha_recordatorio,
                estado
            )
            VALUES (
                ${interpretacion.mensaje.trim()},
                ${fecha.toISOString()},
                'pendiente'
            )
            RETURNING
                id,
                mensaje,
                fecha_recordatorio,
                estado
        `;

        // =====================================
        // CONFIRMAR
        // =====================================

        const recordatorio = resultado[0];

        const fechaBonita = new Intl.DateTimeFormat("es-PE", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "America/Lima"
        }).format(fecha);

        return res.status(201).json({

            ok: true,

            accion: "creado",

            respuesta:
                `¡Listo, brother! 🤖 He guardado tu recordatorio: ` +
                `${recordatorio.mensaje}. Te avisaré el ${fechaBonita}.`,

            recordatorio

        });

    } catch (error) {

        console.error("Error creando recordatorio con IA:", error);

        return res.status(500).json({
            error: "No pude crear el recordatorio. Inténtalo nuevamente."
        });
    }
}
