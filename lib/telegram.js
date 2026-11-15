
const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function enviarTelegram(mensaje) {

    if (!TOKEN || !CHAT_ID) {
        throw new Error("Faltan las variables de Telegram en Vercel");
    }

    const respuesta = await fetch(
        `https://api.telegram.org/bot${TOKEN}/sendMessage`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: mensaje
            })
        }
    );

    const datos = await respuesta.json();

    if (!respuesta.ok || !datos.ok) {
        console.error("Error Telegram:", datos);
        throw new Error("No se pudo enviar el mensaje por Telegram");
    }

    return true;
}
