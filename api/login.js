
import crypto from "node:crypto";
import { crearCookieSesion } from "../lib/auth.js";

export default async function handler(req, res) {

    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Método no permitido"
        });
    }

    try {
        const password = req.body?.password;
        const passwordCorrecta = process.env.ROBOT_ACCESS_PASSWORD;

        if (!passwordCorrecta) {
            return res.status(500).json({
                error: "La autenticación no está configurada"
            });
        }

        if (typeof password !== "string" || !password) {
            return res.status(400).json({
                error: "Introduce tu contraseña"
            });
        }

        const recibido = crypto
            .createHash("sha256")
            .update(password)
            .digest();

        const esperado = crypto
            .createHash("sha256")
            .update(passwordCorrecta)
            .digest();

        if (!crypto.timingSafeEqual(recibido, esperado)) {
            return res.status(401).json({
                error: "Contraseña incorrecta"
            });
        }

        res.setHeader("Set-Cookie", crearCookieSesion());

        return res.status(200).json({
            ok: true,
            mensaje: "Sesión iniciada correctamente"
        });

    } catch (error) {
        console.error("Error de login:", error);

        return res.status(500).json({
            error: "No se pudo iniciar sesión"
        });
    }
}
