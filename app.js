
const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";

const CHARACTERISTIC_UUID =
    "12345678-1234-1234-1234-1234567890ac";

let robotDevice = null;
let robotCharacteristic = null;


// =====================================
// ELEMENTOS DE LA INTERFAZ
// =====================================

const connectButton = document.getElementById("connectButton");
const disconnectButton = document.getElementById("disconnectButton");

const statusLight = document.getElementById("statusLight");
const statusText = document.getElementById("statusText");

const robotState = document.getElementById("robotState");
const robotMessage = document.getElementById("robotMessage");
const robotSubmessage = document.getElementById("robotSubmessage");

const messageInput = document.getElementById("messageInput");
const sendMessageButton = document.getElementById("sendMessageButton");

const activityLog = document.getElementById("activityLog");

const estadoMicrofono = document.getElementById("estadoMicrofono");
const textoEscuchado = document.getElementById("textoEscuchado");


// =====================================
// VARIABLES DE RECONOCIMIENTO MANUAL
// =====================================

const ReconocimientoVoz =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let reconocimiento = null;

let escuchando = false;
let robotHablando = false;

let textoCapturado = "";
let detenerSolicitado = false;
let procesandoPregunta = false;

let idVozActual = 0;


// =====================================
// REGISTRO DE ACTIVIDAD
// =====================================

function registrarActividad(mensaje) {

    const hora = new Date().toLocaleTimeString("es-PE");

    const linea = document.createElement("p");

    linea.textContent = `[${hora}] ${mensaje}`;

    activityLog.prepend(linea);

    while (activityLog.children.length > 30) {
        activityLog.lastElementChild.remove();
    }
}


// =====================================
// ACTUALIZAR CONEXIÓN
// =====================================

function actualizarConexion(conectado) {

    statusLight.classList.toggle("connected", conectado);

    statusText.textContent =
        conectado ? "CONECTADO" : "DESCONECTADO";

    robotState.textContent =
        conectado ? "ONLINE" : "OFFLINE";

    connectButton.disabled = conectado;
    disconnectButton.disabled = !conectado;

    if (conectado) {

        robotMessage.textContent = "ROBOT CONECTADO";

        robotSubmessage.textContent =
            "Comunicación Bluetooth establecida";

    } else {

        robotMessage.textContent = "HOLA, BROTHER";

        robotSubmessage.textContent =
            "Tu compañero está esperando órdenes";
    }
}


// =====================================
// CONECTAR CON EL ESP32-C3
// =====================================

async function conectarRobot() {

    if (!navigator.bluetooth) {

        alert(
            "Tu navegador no permite Web Bluetooth. " +
            "Abre esta aplicación desde Chrome en Android " +
            "y utiliza una conexión HTTPS."
        );

        return;
    }

    try {

        registrarActividad("Buscando mini robot...");

        robotDevice = await navigator.bluetooth.requestDevice({

            filters: [
                { name: "MINI_ROBOT" }
            ],

            optionalServices: [SERVICE_UUID]

        });

        robotDevice.addEventListener(
            "gattserverdisconnected",
            desconexionRobot
        );

        registrarActividad("Robot encontrado. Conectando...");

        const server = await robotDevice.gatt.connect();

        const service = await server.getPrimaryService(
            SERVICE_UUID
        );

        robotCharacteristic = await service.getCharacteristic(
            CHARACTERISTIC_UUID
        );

        actualizarConexion(true);

        registrarActividad("¡Conexión BLE establecida!");

        await enviarComando("ROBOT");

        estadoMicrofono.textContent = "Micrófono inactivo";

        robotMessage.textContent = "ROBOT LISTO";

        robotSubmessage.textContent =
            "Pulsa HABLAR cuando quieras conversar";

    } catch (error) {

        console.error(error);

        registrarActividad("Error: " + error.message);

        alert(
            "No se pudo conectar con el robot.\n" +
            "Comprueba que esté encendido y que Bluetooth esté activo."
        );

        if (robotDevice && robotDevice.gatt.connected) {
            robotDevice.gatt.disconnect();
        }
    }
}


// =====================================
// DESCONECTAR
// =====================================

function desconexionRobot() {

    detenerSolicitado = false;

    if (reconocimiento && escuchando) {
        reconocimiento.stop();
    }

    escuchando = false;
    textoCapturado = "";
    procesandoPregunta = false;

    detenerVozRobot();

    robotCharacteristic = null;
    robotDevice = null;

    estadoMicrofono.textContent = "Micrófono inactivo";

    actualizarConexion(false);

    registrarActividad("Robot desconectado.");
}


// =====================================
// ENVIAR COMANDOS BLE
// =====================================

async function enviarComando(comando) {

    if (!robotCharacteristic) {

        alert("Primero conecta tu mini robot.");

        return;
    }

    try {

        const orden = comando.trim().toUpperCase();

        if (!orden) return;

        const datos = new TextEncoder().encode(orden);

        await robotCharacteristic.writeValue(datos);

        registrarActividad("Orden enviada: " + orden);

        actualizarMensaje(orden);

    } catch (error) {

        console.error(error);

        registrarActividad("Error al enviar: " + error.message);

        alert("No se pudo enviar el comando.");
    }
}


// =====================================
// ENVIAR ESTADOS AL ESP32
// =====================================

async function enviarEstadoRobot(estado) {

    if (!robotCharacteristic) return;

    try {

        const datos = new TextEncoder().encode(estado);

        await robotCharacteristic.writeValue(datos);

        console.log("Estado del robot:", estado);

    } catch (error) {

        console.error("Error enviando estado:", error);
    }
}


// =====================================
// ACTUALIZAR TEXTO VISUAL
// =====================================

function actualizarMensaje(comando) {

    const mensajes = {

        "FELIZ": ["ESTOY FELIZ", "¡Qué alegría!"],
        "TRISTE": ["ESTOY TRISTE", "Necesito cariño"],
        "SORPRESA": ["¡SORPRESA!", "No me lo esperaba"],
        "ENOJADO": ["GRRR...", "Estoy enojado"],
        "AMOR": ["TE QUIERO", "❤️"],
        "SUENO": ["TENGO SUEÑO", "Hora de descansar"],
        "HOLA": ["¡HOLA!", "Me alegra verte"],
        "JAJA": ["JAJAJA", "¡Qué divertido!"],
        "TEQUIERO": ["TE QUIERO", "❤️"],
        "GRACIAS": ["¡GRACIAS!", "Eres genial"],
        "UPS": ["¡UPS!", "¿Qué pasó?"],
        "PERDON": ["ESTÁ BIEN", "No te preocupes"],
        "GRRR": ["GRRR...", "Estoy enojado"],
        "DESCANSAR": ["A DESCANSAR", "Buenas noches"],
        "ROBOT": ["ROBOT ACTIVO", "Estoy despierto"],
        "DORMIR": ["HASTA LUEGO", "Modo descanso"],
        "DESPERTAR": ["¡DESPIERTO!", "Aquí estoy"],
        "INFO": ["INFORMACIÓN", "Modo reloj"],
        "MEMORIA": ["MEMORIA", "Consultando recuerdos"],
        "BORRAR": ["MEMORIA BORRADA", "Estadísticas reiniciadas"]
    };

    if (mensajes[comando]) {

        robotMessage.textContent = mensajes[comando][0];

        robotSubmessage.textContent = mensajes[comando][1];
    }
}


// =====================================
// EVENTOS DE LOS BOTONES
// =====================================

connectButton.addEventListener("click", conectarRobot);

disconnectButton.addEventListener("click", () => {

    if (robotDevice && robotDevice.gatt.connected) {

        robotDevice.gatt.disconnect();
    }
});


// BOTONES DE EMOCIONES Y ACCIONES

document.querySelectorAll("[data-command]").forEach(boton => {

    boton.addEventListener("click", () => {

        enviarComando(boton.dataset.command);
    });
});


// =====================================
// MENSAJE PERSONALIZADO
// =====================================

async function enviarMensaje() {

    const mensaje = messageInput.value.trim();

    if (!mensaje) return;

    messageInput.value = "";

    await procesarMensajeUsuario(mensaje);
}

sendMessageButton.addEventListener("click", enviarMensaje);

messageInput.addEventListener("keydown", event => {

    if (event.key === "Enter") {
        enviarMensaje();
    }
});


// =====================================
// BORRAR MEMORIA
// =====================================

document.getElementById("clearMemoryButton")
    .addEventListener("click", async () => {

        const confirmar = confirm(
            "¿Estás seguro de borrar la memoria del robot? " +
            "Esta acción eliminará sus estadísticas guardadas."
        );

        if (confirmar) {

            await enviarComando("BORRAR");
        }
    });


// =====================================
// INSTALACIÓN PWA
// =====================================

let eventoInstalacion = null;

window.addEventListener("beforeinstallprompt", event => {

    event.preventDefault();

    eventoInstalacion = event;

    registrarActividad("Aplicación disponible para instalar.");
});


// =====================================
// SERVICE WORKER
// =====================================

if ("serviceWorker" in navigator) {

    window.addEventListener("load", async () => {

        try {

            await navigator.serviceWorker.register("./sw.js");

            registrarActividad("Sistema PWA preparado.");

        } catch (error) {

            console.error("Error PWA:", error);
        }
    });
}


// =====================================
// VOZ DEL MINI ROBOT
// =====================================

let vozRobot = null;


// BUSCAR VOZ EN ESPAÑOL

function cargarVozRobot() {

    if (!("speechSynthesis" in window)) return;

    const voces = window.speechSynthesis.getVoices();

    vozRobot =
        voces.find(v => v.lang === "es-PE") ||
        voces.find(v => v.lang === "es-MX") ||
        voces.find(v => v.lang.startsWith("es")) ||
        null;
}

cargarVozRobot();

if ("speechSynthesis" in window) {

    window.speechSynthesis.onvoiceschanged = cargarVozRobot;
}


// =====================================
// HABLAR CON EL MINI ROBOT
// =====================================

function hablarRobot(mensaje) {

    if (!("speechSynthesis" in window)) {

        console.log("Este navegador no admite voz.");

        enviarEstadoRobot("IDLE");

        return;
    }

    idVozActual++;

    const idActual = idVozActual;

    window.speechSynthesis.cancel();

    const voz = new SpeechSynthesisUtterance(mensaje);

    if (vozRobot) {
        voz.voice = vozRobot;
    }

    voz.lang = vozRobot ? vozRobot.lang : "es-ES";

    voz.rate = 1;
    voz.pitch = 1.1;
    voz.volume = 1;

    robotHablando = true;

    voz.onstart = function() {

        if (idActual !== idVozActual) return;

        enviarEstadoRobot("HABLANDO");

        robotMessage.textContent = "ESTOY HABLANDO";

        robotSubmessage.textContent =
            "Babas está hablando contigo";

        console.log("BABAS ESTÁ HABLANDO");
    };


    voz.onend = function() {

        if (idActual !== idVozActual) return;

        robotHablando = false;

        enviarEstadoRobot("IDLE");

        robotMessage.textContent = "ESTOY DISPONIBLE";

        robotSubmessage.textContent =
            "Pulsa HABLAR cuando quieras conversar";
    };


    voz.onerror = function(event) {

        if (idActual !== idVozActual) return;

        console.error("Error de voz:", event.error);

        robotHablando = false;

        enviarEstadoRobot("IDLE");

        robotMessage.textContent = "ESTOY DISPONIBLE";

        robotSubmessage.textContent =
            "Pulsa HABLAR cuando quieras conversar";
    };

    window.speechSynthesis.speak(voz);
}


// =====================================
// DETENER VOZ
// =====================================

function detenerVozRobot() {

    idVozActual++;

    robotHablando = false;

    if ("speechSynthesis" in window) {

        window.speechSynthesis.cancel();
    }

    enviarEstadoRobot("IDLE");
}


// =====================================
// PRUEBA DE VOZ
// =====================================

document.addEventListener("DOMContentLoaded", function() {

    const botonVoz = document.getElementById("probarVoz");

    if (botonVoz) {

        botonVoz.addEventListener("click", function() {

            hablarRobot(
                "Hola brother. Soy tu mini robot. " +
                "Ahora puedo hablar contigo desde tu celular. " +
                "¡Vamos a convertirnos en grandes amigos!"
            );
        });
    }
});


// =====================================
// SISTEMA DE RECONOCIMIENTO MANUAL
// =====================================


// CREAR RECONOCIMIENTO DE VOZ

if (ReconocimientoVoz) {

    reconocimiento = new ReconocimientoVoz();

    reconocimiento.lang = "es-PE";

    reconocimiento.continuous = true;

    reconocimiento.interimResults = true;

} else {

    console.log("Reconocimiento de voz no compatible.");
}


// =====================================
// BOTÓN HABLAR
// =====================================

function iniciarEscuchaManual() {

    if (!robotCharacteristic) {

        alert("Primero conecta tu mini robot.");

        return;
    }

    if (!reconocimiento) {

        alert("Tu navegador no admite reconocimiento de voz.");

        return;
    }

    if (escuchando || robotHablando || procesandoPregunta) {
        return;
    }

    textoCapturado = "";

    detenerSolicitado = false;

    textoEscuchado.textContent = "Te estoy escuchando...";

    estadoMicrofono.textContent = "🎙️ MICRÓFONO ACTIVADO";

    robotMessage.textContent = "TE ESCUCHO";

    robotSubmessage.textContent =
        "Habla y pulsa DETENER cuando termines";

    enviarEstadoRobot("ESCUCHANDO");

    try {

        reconocimiento.start();

        registrarActividad("Micrófono activado manualmente.");

    } catch (error) {

        console.error(error);

        registrarActividad(
            "No se pudo iniciar el micrófono: " + error.message
        );
    }
}


// =====================================
// BOTÓN DETENER
// =====================================

function detenerEscuchaManual() {

    if (!reconocimiento || !escuchando) {
        return;
    }

    detenerSolicitado = true;

    estadoMicrofono.textContent = "Procesando tu mensaje...";

    robotMessage.textContent = "PROCESANDO AUDIO";

    robotSubmessage.textContent =
        "Estoy preparando tu pregunta";

    reconocimiento.stop();

    registrarActividad("Grabación detenida manualmente.");
}


// =====================================
// EVENTOS DEL RECONOCIMIENTO
// =====================================

if (reconocimiento) {

    reconocimiento.onstart = function() {

        escuchando = true;

        console.log("Micrófono activado.");

        estadoMicrofono.textContent = "🎙️ ESCUCHANDO...";
    };


    // RECONOCER VOZ

    reconocimiento.onresult = function(event) {

        let textoTemporal = "";

        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const resultado = event.results[i];

            const texto = resultado[0].transcript;

            if (resultado.isFinal) {

                textoCapturado += texto + " ";

            } else {

                textoTemporal += texto;
            }
        }

        const textoVisible =
            (textoCapturado + textoTemporal).trim();

        textoEscuchado.textContent =
            textoVisible
                ? "Tú: " + textoVisible
                : "Te estoy escuchando...";
    };


    // ERRORES DE RECONOCIMIENTO

    reconocimiento.onerror = function(event) {

        console.error("Error de reconocimiento:", event.error);

        estadoMicrofono.textContent =
            "Error: " + event.error;

        registrarActividad(
            "Error de micrófono: " + event.error
        );

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {

            detenerSolicitado = false;

            robotMessage.textContent = "MICRÓFONO BLOQUEADO";

            robotSubmessage.textContent =
                "Permite el acceso al micrófono";
        }

        if (event.error === "audio-capture") {

            detenerSolicitado = false;

            robotMessage.textContent = "ERROR DE MICRÓFONO";

            robotSubmessage.textContent =
                "Comprueba el micrófono de tu celular";
        }
    };


    // FINALIZAR CAPTURA

    reconocimiento.onend = async function() {

        escuchando = false;

        console.log("Reconocimiento finalizado.");

        if (!detenerSolicitado) {
            return;
        }

        detenerSolicitado = false;

        const mensaje = textoCapturado.trim();

        textoCapturado = "";

        if (!mensaje) {

            estadoMicrofono.textContent = "Micrófono inactivo";

            robotMessage.textContent = "NO DETECTÉ TU VOZ";

            robotSubmessage.textContent =
                "Pulsa HABLAR e inténtalo nuevamente";

            enviarEstadoRobot("IDLE");

            return;
        }

        textoEscuchado.textContent = "Tú: " + mensaje;

        estadoMicrofono.textContent = "Pregunta enviada";

        procesandoPregunta = true;

        try {

            await procesarMensajeUsuario(mensaje);

        } finally {

            procesandoPregunta = false;

            estadoMicrofono.textContent = "Micrófono inactivo";
        }
    };
}


// =====================================
// CONECTAR LOS BOTONES DE VOZ
// =====================================

const botonIniciarEscucha =
    document.getElementById("iniciarEscucha");

const botonDetenerEscucha =
    document.getElementById("detenerEscucha");

if (botonIniciarEscucha) {

    botonIniciarEscucha.addEventListener(
        "click",
        iniciarEscuchaManual
    );
}

if (botonDetenerEscucha) {

    botonDetenerEscucha.addEventListener(
        "click",
        detenerEscuchaManual
    );
}


// =====================================
// INTELIGENCIA ARTIFICIAL OPENROUTER
// =====================================

async function consultarMiniRobot(mensaje) {

    const respuesta = await fetch("/api/chat", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            mensaje: mensaje
        })
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {

        throw new Error(
            datos.error || "No se pudo conectar con la IA"
        );
    }

    if (!datos.respuesta) {

        throw new Error(
            "La IA no devolvió una respuesta."
        );
    }

    return datos.respuesta;
}


// =====================================
// PROCESAR MENSAJE DEL USUARIO
// =====================================

async function procesarMensajeUsuario(mensaje) {

    const respuestaElemento =
        document.getElementById("respuestaRobot");

    const texto = mensaje.trim();

    if (!texto) return;

    enviarEstadoRobot("PENSANDO");

    respuestaElemento.textContent =
        "MINI ROBOT: Estoy pensando... 🤔";

    robotMessage.textContent = "PROCESANDO";

    robotSubmessage.textContent =
        "Estoy consultando mi inteligencia artificial";

    registrarActividad(
        "Pregunta enviada a OpenRouter: " + texto
    );

    try {

        const respuesta =
            await consultarMiniRobot(texto);

        respuestaElemento.textContent =
            "MINI ROBOT: " + respuesta;

        robotMessage.textContent = "NUEVA RESPUESTA";

        robotSubmessage.textContent =
            "Tengo algo que contarte";

        registrarActividad(
            "Respuesta recibida correctamente."
        );

        hablarRobot(respuesta);

    } catch (error) {

        console.error("Error IA:", error);

        respuestaElemento.textContent =
            "MINI ROBOT: No pude conectarme con mi cerebro. " +
            "Inténtalo nuevamente.";

        robotMessage.textContent = "ERROR DE CONEXIÓN";

        robotSubmessage.textContent =
            "No pude consultar mi inteligencia artificial";

        registrarActividad(
            "Error de IA: " + error.message
        );

        hablarRobot(
            "Brother, tuve un problema al conectarme. " +
            "Por favor, inténtalo nuevamente."
        );
    }
}


// =====================================
// INICIO DEL SISTEMA
// =====================================

actualizarConexion(false);

registrarActividad("MINI ROBOT CONTROL iniciado.");
