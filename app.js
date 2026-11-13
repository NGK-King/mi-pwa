
const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";

const CHARACTERISTIC_UUID =
    "12345678-1234-1234-1234-1234567890ac";

let robotDevice = null;
let robotCharacteristic = null;

// ELEMENTOS DE LA INTERFAZ

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


// REGISTRO DE ACTIVIDAD

function registrarActividad(mensaje) {

    const hora = new Date().toLocaleTimeString("es-PE");

    const linea = document.createElement("p");

    linea.textContent = `[${hora}] ${mensaje}`;

    activityLog.prepend(linea);

    while (activityLog.children.length > 30) {
        activityLog.lastElementChild.remove();
    }
}


// ACTUALIZAR ESTADO DE CONEXIÓN

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


// CONECTAR CON EL ESP32-C3

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


// DESCONECTAR

function desconexionRobot() {

    robotCharacteristic = null;
    robotDevice = null;

    actualizarConexion(false);

    registrarActividad(
        "Robot desconectado. Listo para reconectar."
    );
}


// ENVIAR COMANDOS BLE

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


// ENVIAR ESTADOS DE ANIMACIÓN AL ESP32

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


// ACTUALIZAR TEXTO VISUAL

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


// EVENTOS DE LOS BOTONES

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


// MENSAJE PERSONALIZADO A LA IA

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


// BORRAR MEMORIA CON CONFIRMACIÓN

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


// INSTALACIÓN PWA

let eventoInstalacion = null;

window.addEventListener("beforeinstallprompt", event => {

    event.preventDefault();

    eventoInstalacion = event;

    registrarActividad("Aplicación disponible para instalar.");
});


// REGISTRO DEL SERVICE WORKER

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


// BUSCAR UNA VOZ EN ESPAÑOL

function cargarVozRobot() {

    if (!("speechSynthesis" in window)) return;

    const voces = window.speechSynthesis.getVoices();

    vozRobot =
        voces.find(v => v.lang === "es-PE") ||
        voces.find(v => v.lang === "es-MX") ||
        voces.find(v => v.lang.startsWith("es")) ||
        null;
}


// CARGAR VOCES DISPONIBLES

cargarVozRobot();

if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = cargarVozRobot;
}


// =====================================
// HACER HABLAR AL ROBOT
// =====================================

function hablarRobot(mensaje) {

    if (!("speechSynthesis" in window)) {

        console.log("Este navegador no admite voz.");

        enviarEstadoRobot("IDLE");

        return;
    }

    // Detener cualquier mensaje anterior

    window.speechSynthesis.cancel();

    const voz = new SpeechSynthesisUtterance(mensaje);

    if (vozRobot) {
        voz.voice = vozRobot;
    }

    voz.lang = vozRobot ? vozRobot.lang : "es-ES";

    voz.rate = 1;
    voz.pitch = 1.1;
    voz.volume = 1;


    // CUANDO COMIENZA A HABLAR

    voz.onstart = function() {

        enviarEstadoRobot("HABLANDO");

        robotMessage.textContent = "ESTOY HABLANDO";

        robotSubmessage.textContent =
            "Escucha lo que tengo que contarte";

        console.log("MINI ROBOT ESTA HABLANDO");
    };


    // CUANDO TERMINA DE HABLAR

    voz.onend = function() {

        enviarEstadoRobot("IDLE");

        robotMessage.textContent = "ROBOT ACTIVO";

        robotSubmessage.textContent =
            "Estoy esperando tu siguiente pregunta";

        console.log("MINI ROBOT TERMINO DE HABLAR");
    };


    // SI OCURRE UN ERROR DE VOZ

    voz.onerror = function(event) {

        enviarEstadoRobot("IDLE");

        console.error("Error de voz:", event.error);
    };


    window.speechSynthesis.speak(voz);
}


// =====================================
// DETENER LA VOZ
// =====================================

function detenerVozRobot() {

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
// RECONOCIMIENTO DE VOZ
// =====================================

const ReconocimientoVoz =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let reconocimiento = null;

let escuchando = false;


if (ReconocimientoVoz) {

    reconocimiento = new ReconocimientoVoz();

    reconocimiento.lang = "es-PE";

    reconocimiento.continuous = false;

    reconocimiento.interimResults = false;


    // CUANDO EL USUARIO COMIENZA A HABLAR

    reconocimiento.onstart = function() {

        escuchando = true;

        enviarEstadoRobot("ESCUCHANDO");

        robotMessage.textContent = "TE ESTOY ESCUCHANDO";

        robotSubmessage.textContent =
            "Estoy atento a lo que me dices";

        document.getElementById("estadoMicrofono").textContent =
            "🎙️ TE ESTOY ESCUCHANDO...";
    };


    // CUANDO RECONOCE EL MENSAJE

    reconocimiento.onresult = function(event) {

        const mensaje = event.results[0][0].transcript;

        document.getElementById("textoEscuchado").textContent =
            "Tú: " + mensaje;

        enviarEstadoRobot("PENSANDO");

        procesarMensajeUsuario(mensaje);
    };


    // SI OCURRE UN ERROR DEL MICRÓFONO

    reconocimiento.onerror = function(event) {

        escuchando = false;

        enviarEstadoRobot("IDLE");

        document.getElementById("estadoMicrofono").textContent =
            "Error del micrófono: " + event.error;

        console.error("Error de reconocimiento:", event.error);
    };


    // CUANDO TERMINA LA ESCUCHA

    reconocimiento.onend = function() {

        escuchando = false;

        document.getElementById("estadoMicrofono").textContent =
            "Micrófono inactivo";
    };

} else {

    console.log("Reconocimiento de voz no compatible.");
}


// =====================================
// INICIAR Y DETENER MICRÓFONO
// =====================================

document.addEventListener("DOMContentLoaded", function() {

    const botonIniciar =
        document.getElementById("iniciarEscucha");

    const botonDetener =
        document.getElementById("detenerEscucha");


    // INICIAR ESCUCHA

    if (botonIniciar) {

        botonIniciar.addEventListener("click", function() {

            if (!reconocimiento) {

                hablarRobot(
                    "Lo siento, tu navegador no admite reconocimiento de voz."
                );

                return;
            }

            if (!escuchando) {

                detenerVozRobot();

                try {

                    reconocimiento.start();

                } catch(error) {

                    console.log(error);
                }
            }
        });
    }


    // DETENER ESCUCHA

    if (botonDetener) {

        botonDetener.addEventListener("click", function() {

            if (reconocimiento && escuchando) {

                reconocimiento.stop();

                enviarEstadoRobot("IDLE");
            }
        });
    }
});


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

        throw new Error("La IA no devolvió una respuesta.");
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


    // EL ROBOT COMIENZA A PENSAR

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


        // MOSTRAR RESPUESTA

        respuestaElemento.textContent =
            "MINI ROBOT: " + respuesta;

        robotMessage.textContent = "NUEVA RESPUESTA";

        robotSubmessage.textContent =
            "Tengo algo que contarte";

        registrarActividad(
            "Respuesta recibida correctamente."
        );


        // EL ROBOT PRONUNCIA LA RESPUESTA
        // HABLARÁ Y MOVERÁ LA BOCA EN LA OLED

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


        // EL ROBOT TAMBIÉN COMUNICARÁ EL ERROR

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
