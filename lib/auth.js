
import crypto from "node:crypto";

const COOKIE_NAME = "mini_robot_session";
const SESSION_DURATION = 7 * 24 * 60 * 60;

function obtenerSecreto() {
    const secreto = process.env.ROBOT_SESSION_SECRET;

    if (!secreto || secreto.length < 32) {
        throw new Error("ROBOT_SESSION_SECRET no está configurado correctamente");
    }

    return secreto;
}

function firmar(datos) {
    return crypto
        .createHmac("sha256", obtenerSecreto())
        .update(datos)
        .digest("base64url");
}

function obtenerCookies(req) {
    const cabecera = req.headers.cookie || "";

    return Object.fromEntries(
        cabecera.split(";").map(parte => {
            const indice = parte.indexOf("=");

            if (indice < 0) return ["", ""];

            return [
                parte.slice(0, indice).trim(),
                parte.slice(indice + 1).trim()
            ];
        }).filter(([clave]) => clave)
    );
}

export function crearCookieSesion() {
    const payload = Buffer.from(JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + SESSION_DURATION
    })).toString("base64url");

    const token = `${payload}.${firmar(payload)}`;

    const secure = process.env.NODE_ENV === "production"
        ? "; Secure"
        : "";

    return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_DURATION}${secure}`;
}

export function eliminarCookieSesion() {
    const secure = process.env.NODE_ENV === "production"
        ? "; Secure"
        : "";

    return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`;
}

export function tieneSesion(req) {
    try {
        const cookies = obtenerCookies(req);
        const token = cookies[COOKIE_NAME];

        if (!token) return false;

        const partes = token.split(".");

        if (partes.length !== 2) return false;

        const [payload, firmaRecibida] = partes;
        const firmaEsperada = firmar(payload);

        const recibida = Buffer.from(firmaRecibida, "base64url");
        const esperada = Buffer.from(firmaEsperada, "base64url");

        if (
            recibida.length !== esperada.length ||
            !crypto.timingSafeEqual(recibida, esperada)
        ) {
            return false;
        }

        const datos = JSON.parse(
            Buffer.from(payload, "base64url").toString("utf8")
        );

        return Number.isInteger(datos.exp) &&
            datos.exp > Math.floor(Date.now() / 1000);

    } catch (error) {
        console.error("Error verificando sesión:", error.message);
        return false;
    }
}
