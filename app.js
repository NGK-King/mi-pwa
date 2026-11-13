
const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "12345678-1234-1234-1234-1234567890ac";

let robotDevice = null;
let robotCharacteristic = null;

// =====================================
// ELEMENTOS HTML
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

const respuestaElemento = document.getElementById("respuestaRobot");


// =====================================
// VARIABLES DEL SISTEMA
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

let temporizadorRegresoRostro = null;
let mostrandoReloj = false;


// =====================================
// ACTUALIZAR TEXTO DE FORMA SEGURA
// =====================================

function cambiarTexto(elemento, mensaje) {

    if (elemento) {
        elemento.textContent = mensaje;
    }
}


// =====================================
// REGISTRO DE ACTIVIDAD
// =====================================

function registrarActividad(mensaje) {

    if (!activityLog) return;

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

    if (statusLight) {
        statusLight.classList.toggle("connected", conectado);
    }

    cambiarTexto(
        statusText,
        conectado ? "CONECTADO" : "DESCONECTADO"
    );

    cambiarTexto(
        robotState,
        conectado ? "ONLINE" : "OFFLINE"
    );

    if (connectButton) {
        connectButton.disabled = conectado;
    }

    if (disconnectButton) {
        disconnectButton.disabled = !conectado;
    }

    if (conectado) {

        cambiarTexto(robotMessage, "ROBOT CONECTADO");

        cambiarTexto(
            robotSubmessage,
            "Comunicación Bluetooth establecida"
        );

    } else {

        cambiarTexto(robotMessage, "HOLA, BROTHER");

        cambiarTexto(
            robotSubmessage,
            "Tu compañero está esperando órdenes"
        );
    }
}


// =====================================
// CONECTAR ROBOT
// =====================================

async function conectarRobot() {

    if (!navigator.bluetooth) {

        alert(
            "Abre esta aplicación desde Chrome Android " +
            "utilizando una conexión HTTPS."
        );

        return;
    }

    try {

        registrarActividad("Buscando mini robot...");

        robotDevice = await navigator.bluetooth.requestDevice({

            filters: [{ name: "MINI_ROBOT" }],

            optionalServices: [SERVICE_UUID]

        });

        robotDevice.addEventListener(
            "gattserverdisconnected",
            desconexionRobot
        );

        const server = await robotDevice.gatt.connect();

        const service = await server.getPrimaryService(SERVICE_UUID);

        robotCharacteristic =
            await service.getCharacteristic(CHARACTERISTIC_UUID);

        actualizarConexion(true);

        registrarActividad("Bluetooth conectado correctamente.");

        await enviarComando("ROBOT");

        cambiarTexto(
            estadoMicrofono,
            "Micrófono inactivo"
        );

        cambiarTexto(robotMessage, "ROBOT LISTO");

        cambiarTexto(
            robotSubmessage,
            "Pulsa HABLAR cuando quieras conversar"
        );

    } catch (error) {

        console.error(error);

        registrarActividad("Error de conexión: " + error.message);

        alert("No se pudo conectar con el mini robot.");

        if (robotDevice && robotDevice.gatt.connected) {
            robotDevice.gatt.disconnect();
        }
    }
}


// =====================================
// DESCONECTAR ROBOT
// =====================================

function desconexionRobot() {

    clearTimeout(temporizadorRegresoRostro);

    temporizadorRegresoRostro = null;

    mostrandoReloj = false;

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

    cambiarTexto(
        estadoMicrofono,
        "Micrófono inactivo"
    );

    actualizarConexion(false);

    registrarActividad("Robot desconectado.");
}


// =====================================
// ENVIAR COMANDOS BLUETOOTH
// =====================================

async function enviarComando(comando) {

    if (!robotCharacteristic) {

        registrarActividad("ERROR: robot desconectado.");

        return false;
    }

    try {

        const orden = comando.trim().toUpperCase();

        if (!orden) return false;

        const datos = new TextEncoder().encode(orden);

        await robotCharacteristic.writeValue(datos);

        registrarActividad("ORDEN BLE ENVIADA: " + orden);

        actualizarMensaje(orden);

        return true;

    } catch (error) {

        console.error(error);

        registrarActividad(
            "Error BLE: " + error.message
        );

        return false;
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
// MENSAJES DE ESTADO
// =====================================

function actualizarMensaje(comando) {

    const mensajes = {

        "ROBOT": [
            "ROBOT ACTIVO",
            "Estoy despierto"
        ],

        "DORMIR": [
            "HASTA LUEGO",
            "Modo descanso"
        ],

        "DESPERTAR": [
            "¡DESPIERTO!",
            "Aquí estoy"
        ],

        "INFO": [
            "MOSTRANDO LA HORA",
            "Pantalla de reloj"
        ]

    };

    if (mensajes[comando]) {

        cambiarTexto(
            robotMessage,
            mensajes[comando][0]
        );

        cambiarTexto(
            robotSubmessage,
            mensajes[comando][1]
        );
    }
}


// =====================================
// NORMALIZAR TEXTO
// =====================================

function normalizarTexto(mensaje) {

    return mensaje
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[¿?¡!,.;:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


// =====================================
// DETECTAR PETICIÓN DE HORA O FECHA
// =====================================

function esSolicitudHora(mensaje) {

    const texto = normalizarTexto(mensaje);

    const palabrasClave = [
        "hora",
        "reloj",
        "fecha"
    ];

    const frasesClave = [
        "que dia es hoy",
        "dime que dia es",
        "muestrame la fecha",
        "ensename la fecha",
        "que fecha es",
        "quiero ver la fecha",
        "dime la fecha",
        "muestrame la hora",
        "quiero ver la hora",
        "ensename la hora",
        "que hora es",
        "dime la hora",
        "quiero ver el reloj",
        "muestrame el reloj",
        "ensename el reloj",
        "dime que hora es"
    ];

    const contienePalabra =
        palabrasClave.some(palabra =>
            texto.includes(palabra)
        );

    const contieneFrase =
        frasesClave.some(frase =>
            texto.includes(frase)
        );

    const resultado = contienePalabra || contieneFrase;

    console.log("TEXTO NORMALIZADO:", texto);

    console.log("SOLICITUD DE RELOJ:", resultado);

    return resultado;
}


// =====================================
// MOSTRAR RELOJ DURANTE 10 SEGUNDOS
// =====================================

async function mostrarHoraRobot() {

    if (!robotCharacteristic) {

        registrarActividad(
            "No se puede mostrar el reloj: robot desconectado."
        );

        return;
    }

    clearTimeout(temporizadorRegresoRostro);

    temporizadorRegresoRostro = null;

    mostrandoReloj = true;

    registrarActividad("Detectada solicitud de hora o fecha.");

    cambiarTexto(robotMessage, "MOSTRANDO RELOJ");

    cambiarTexto(
        robotSubmessage,
        "Hora y fecha durante 10 segundos"
    );

    cambiarTexto(
        respuestaElemento,
        "MINI ROBOT: Aquí tienes la hora y la fecha."
    );

    const enviado = await enviarComando("INFO");

    if (!enviado) {

        mostrandoReloj = false;

        cambiarTexto(
            robotMessage,
            "ERROR AL MOSTRAR RELOJ"
        );

        cambiarTexto(
            robotSubmessage,
            "No pude enviar INFO al ESP32"
        );

        return;
    }

    registrarActividad("INFO enviado. Esperando 10 segundos.");

    temporizadorRegresoRostro = setTimeout(async () => {

        if (!robotCharacteristic) {

            mostrandoReloj = false;

            return;
        }

        registrarActividad(
            "Han pasado 10 segundos. Regresando al rostro."
        );

        const regresado = await enviarComando("ROBOT");

        mostrandoReloj = false;

        if (regresado) {

            cambiarTexto(robotMessage, "ROBOT ACTIVO");

            cambiarTexto(
                robotSubmessage,
                "He vuelto a mis ojos animados"
            );

            registrarActividad("ROBOT enviado correctamente.");
        }

        temporizadorRegresoRostro = null;

    }, 10000);
}


// =====================================
// BOTONES DE CONEXIÓN
// =====================================

if (connectButton) {
    connectButton.addEventListener("click", conectarRobot);
}

if (disconnectButton) {

    disconnectButton.addEventListener("click", () => {

        if (robotDevice && robotDevice.gatt.connected) {
            robotDevice.gatt.disconnect();
        }
    });
}


// =====================================
// CONTROLES DEL OLED
// =====================================

document.querySelectorAll("[data-command]").forEach(boton => {

    boton.addEventListener("click", async () => {

        const comando = boton.dataset.command;

        if (comando !== "INFO") {

            clearTimeout(temporizadorRegresoRostro);

            temporizadorRegresoRostro = null;

            mostrandoReloj = false;
        }

        await enviarComando(comando);
    });
});


// =====================================
// MENSAJES PERSONALIZADOS
// =====================================

async function enviarMensaje() {

    if (!messageInput) return;

    const mensaje = messageInput.value.trim();

    if (!mensaje) return;

    messageInput.value = "";

    await procesarMensajeUsuario(mensaje);
}

if (sendMessageButton) {
    sendMessageButton.addEventListener("click", enviarMensaje);
}

if (messageInput) {

    messageInput.addEventListener("keydown", event => {

        if (event.key === "Enter") {
            enviarMensaje();
        }
    });
}


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
// VOZ DEL ROBOT
// =====================================

let vozRobot = null;

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
// HACER HABLAR AL ROBOT
// =====================================

function hablarRobot(mensaje) {

    if (!("speechSynthesis" in window)) {

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

        cambiarTexto(robotMessage, "ESTOY HABLANDO");

        cambiarTexto(
            robotSubmessage,
            "Babas está hablando contigo"
        );
    };

    voz.onend = function() {

        if (idActual !== idVozActual) return;

        robotHablando = false;

        enviarEstadoRobot("IDLE");

        if (!mostrandoReloj) {

            cambiarTexto(
                robotMessage,
                "ESTOY DISPONIBLE"
            );

            cambiarTexto(
                robotSubmessage,
                "Pulsa HABLAR cuando quieras conversar"
            );
        }
    };

    voz.onerror = function(event) {

        if (idActual !== idVozActual) return;

        console.error("Error de voz:", event.error);

        robotHablando = false;

        enviarEstadoRobot("IDLE");
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


// =====================================
// RECONOCIMIENTO DE VOZ
// =====================================

if (ReconocimientoVoz) {

    reconocimiento = new ReconocimientoVoz();

    reconocimiento.lang = "es-PE";

    reconocimiento.continuous = true;

    reconocimiento.interimResults = true;

} else {

    console.log("Reconocimiento de voz no compatible.");
}


// =====================================
// INICIAR ESCUCHA
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

    cambiarTexto(
        textoEscuchado,
        "Te estoy escuchando..."
    );

    cambiarTexto(
        estadoMicrofono,
        "🎙️ MICRÓFONO ACTIVADO"
    );

    cambiarTexto(robotMessage, "TE ESCUCHO");

    cambiarTexto(
        robotSubmessage,
        "Habla y pulsa DETENER cuando termines"
    );

    enviarEstadoRobot("ESCUCHANDO");

    try {

        reconocimiento.start();

        registrarActividad("Micrófono activado.");

    } catch (error) {

        console.error(error);

        registrarActividad(
            "Error al iniciar micrófono: " + error.message
        );
    }
}


// =====================================
// DETENER ESCUCHA
// =====================================

function detenerEscuchaManual() {

    if (!reconocimiento || !escuchando) {
        return;
    }

    detenerSolicitado = true;

    cambiarTexto(
        estadoMicrofono,
        "Procesando tu mensaje..."
    );

    cambiarTexto(robotMessage, "PROCESANDO AUDIO");

    cambiarTexto(
        robotSubmessage,
        "Estoy preparando tu pregunta"
    );

    reconocimiento.stop();

    registrarActividad("Grabación detenida.");
}


// =====================================
// EVENTOS DE RECONOCIMIENTO
// =====================================

if (reconocimiento) {

    reconocimiento.onstart = function() {

        escuchando = true;

        cambiarTexto(
            estadoMicrofono,
            "🎙️ ESCUCHANDO..."
        );

        registrarActividad("Reconocimiento iniciado.");
    };


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

        cambiarTexto(
            textoEscuchado,
            textoVisible
                ? "Tú: " + textoVisible
                : "Te estoy escuchando..."
        );

        console.log(
            "Texto detectado por micrófono:",
            textoVisible
        );
    };


    reconocimiento.onerror = function(event) {

        console.error(
            "Error de reconocimiento:",
            event.error
        );

        cambiarTexto(
            estadoMicrofono,
            "Error: " + event.error
        );

        registrarActividad(
            "Error de micrófono: " + event.error
        );

        if (
            event.error === "not-allowed" ||
            event.error === "service-not-allowed"
        ) {

            detenerSolicitado = false;

            cambiarTexto(
                robotMessage,
                "MICRÓFONO BLOQUEADO"
            );

            cambiarTexto(
                robotSubmessage,
                "Permite el acceso al micrófono"
            );
        }

        if (event.error === "audio-capture") {

            detenerSolicitado = false;

            cambiarTexto(
                robotMessage,
                "ERROR DE MICRÓFONO"
            );

            cambiarTexto(
                robotSubmessage,
                "Comprueba el micrófono de tu celular"
            );
        }
    };


    reconocimiento.onend = async function() {

        escuchando = false;

        registrarActividad("Reconocimiento finalizado.");

        if (!detenerSolicitado) return;

        detenerSolicitado = false;

        const mensaje = textoCapturado.trim();

        textoCapturado = "";

        if (!mensaje) {

            cambiarTexto(
                estadoMicrofono,
                "Micrófono inactivo"
            );

            cambiarTexto(
                robotMessage,
                "NO DETECTÉ TU VOZ"
            );

            cambiarTexto(
                robotSubmessage,
                "Pulsa HABLAR e inténtalo nuevamente"
            );

            enviarEstadoRobot("IDLE");

            return;
        }

        cambiarTexto(
            textoEscuchado,
            "Tú: " + mensaje
        );

        registrarActividad(
            "FRASE RECONOCIDA: " + mensaje
        );

        cambiarTexto(
            estadoMicrofono,
            "Pregunta enviada"
        );

        procesandoPregunta = true;

        try {

            await procesarMensajeUsuario(mensaje);

        } finally {

            procesandoPregunta = false;

            cambiarTexto(
                estadoMicrofono,
                "Micrófono inactivo"
            );
        }
    };
}


// =====================================
// BOTONES DE VOZ
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
// OPENROUTER
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

    const texto = mensaje.trim();

    if (!texto) return;

    console.log("PROCESANDO MENSAJE:", texto);

    // DETECTAR SOLICITUD DE HORA O FECHA

    if (esSolicitudHora(texto)) {

        registrarActividad(
            "COMANDO ESPECIAL: MOSTRAR RELOJ"
        );

        await mostrarHoraRobot();

        return;
    }

    // CONSULTAR INTELIGENCIA ARTIFICIAL

    clearTimeout(temporizadorRegresoRostro);

    temporizadorRegresoRostro = null;

    mostrandoReloj = false;

    enviarEstadoRobot("PENSANDO");

    cambiarTexto(
        respuestaElemento,
        "MINI ROBOT: Estoy pensando... 🤔"
    );

    cambiarTexto(robotMessage, "PROCESANDO");

    cambiarTexto(
        robotSubmessage,
        "Estoy consultando mi inteligencia artificial"
    );

    registrarActividad(
        "Pregunta enviada a OpenRouter: " + texto
    );

    try {

        const respuesta = await consultarMiniRobot(texto);

        cambiarTexto(
            respuestaElemento,
            "MINI ROBOT: " + respuesta
        );

        cambiarTexto(
            robotMessage,
            "NUEVA RESPUESTA"
        );

        cambiarTexto(
            robotSubmessage,
            "Tengo algo que contarte"
        );

        registrarActividad(
            "Respuesta recibida correctamente."
        );

        hablarRobot(respuesta);

    } catch (error) {

        console.error("Error IA:", error);

        cambiarTexto(
            respuestaElemento,
            "MINI ROBOT: No pude conectarme con mi cerebro."
        );

        cambiarTexto(
            robotMessage,
            "ERROR DE CONEXIÓN"
        );

        cambiarTexto(
            robotSubmessage,
            "No pude consultar mi inteligencia artificial"
        );

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

registrarActividad(
    "MINI ROBOT COMMAND CENTER iniciado."
);

console.log("MINI ROBOT AI iniciado correctamente.");
