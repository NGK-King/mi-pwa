
const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "12345678-1234-1234-1234-1234567890ac";

let robotDevice = null;
let robotCharacteristic = null;

// COLA DE COMANDOS BLUETOOTH
let colaBLE = Promise.resolve();

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
// AUTENTICACIÓN MINI ROBOT
// =====================================

const loginScreen = document.getElementById("loginScreen");
const appContainer = document.getElementById("appContainer");
const loginForm = document.getElementById("loginForm");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");
const logoutButton = document.getElementById("logoutButton");

function mostrarLogin(mensaje = "") {
    if (loginScreen) loginScreen.hidden = false;
    if (appContainer) appContainer.hidden = true;

    if (loginError) loginError.textContent = mensaje;
    if (loginPassword) loginPassword.value = "";
}

function mostrarAplicacion() {
    if (loginScreen) loginScreen.hidden = true;
    if (appContainer) appContainer.hidden = false;

    actualizarConexion(false);

    registrarActividad(
        "MINI ROBOT COMMAND CENTER iniciado."
    );

    console.log("MINI ROBOT AI iniciado correctamente.");
}

// Comprobar la sesión guardada en la cookie HttpOnly
async function verificarSesion() {
    try {
        const respuesta = await fetch("/api/session", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!respuesta.ok) return false;

        const datos = await respuesta.json();

        return datos.ok !== false &&
               datos.authenticated !== false &&
               datos.autenticado !== false;

    } catch (error) {
        console.error("Error verificando sesión:", error);
        return false;
    }
}

// Iniciar sesión
if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const password = loginPassword.value;

        if (!password.trim()) {
            loginError.textContent = "Introduce tu contraseña.";
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = "VERIFICANDO...";
        loginError.textContent = "";

        try {
            const respuesta = await fetch("/api/login", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ password })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.error || "No se pudo iniciar sesión."
                );
            }

            const sesionValida = await verificarSesion();

            if (!sesionValida) {
                throw new Error(
                    "No se pudo verificar la sesión. Inténtalo nuevamente."
                );
            }

            mostrarAplicacion();

        } catch (error) {
            console.error("Error de inicio de sesión:", error);
            loginError.textContent = error.message;

        } finally {
            loginButton.disabled = false;
            loginButton.textContent = "INICIAR SESIÓN";
        }
    });
}

// Cerrar sesión
if (logoutButton) {
    logoutButton.addEventListener("click", async () => {

        logoutButton.disabled = true;

        try {
            const respuesta = await fetch("/api/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            if (!respuesta.ok) {
                throw new Error("No se pudo cerrar la sesión.");
            }

            // Detener funciones que puedan seguir activas
            if (robotDevice?.gatt.connected) {
                robotDevice.gatt.disconnect();
            }

            detenerVozRobot();

            if (reconocimiento && escuchando) {
                reconocimiento.stop();
            }

            mostrarLogin("Sesión cerrada correctamente.");

        } catch (error) {
            console.error("Error al cerrar sesión:", error);
            alert(error.message);

        } finally {
            logoutButton.disabled = false;
        }
    });
}

// Comprobar sesión al abrir la aplicación
async function iniciarAutenticacion() {

    mostrarLogin("Comprobando acceso...");

    const sesionValida = await verificarSesion();

    if (sesionValida) {
        mostrarAplicacion();
    } else {
        mostrarLogin();
    }
}



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

let segmentosFinales = [];

let detenerSolicitado = false;
let procesandoPregunta = false;

let idVozActual = 0;

let temporizadorRegresoRostro = null;
let mostrandoReloj = false;
let intervaloRelojOLED = null;


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
	clearInterval(intervaloRelojOLED);

	temporizadorRegresoRostro = null;
	intervaloRelojOLED = null;

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

    if (!robotCharacteristic || !robotDevice?.gatt.connected) {

        registrarActividad("ERROR: robot desconectado.");

        return false;
    }

    const orden = comando.trim().toUpperCase();

    if (!orden) return false;

    const inicio = performance.now();

    // Añadir el envío a la cola para evitar escrituras simultáneas
    const operacion = colaBLE.then(async () => {

        if (!robotCharacteristic || !robotDevice?.gatt.connected) {
            throw new Error("Bluetooth desconectado");
        }

        const datos = new TextEncoder().encode(orden);

        console.log("BLE: iniciando envío:", orden);

        const inicioEscritura = performance.now();

        if (typeof robotCharacteristic.writeValueWithResponse === "function") {

            await robotCharacteristic.writeValueWithResponse(datos);

        } else {

            await robotCharacteristic.writeValue(datos);
        }

        const finEscritura = performance.now();

        console.log(
            "BLE: escritura completada:",
            orden,
            (finEscritura - inicioEscritura).toFixed(2),
            "ms"
        );

        registrarActividad("ORDEN BLE ENVIADA: " + orden);

        actualizarMensaje(orden);

        return true;
    });

    // Mantener la cola operativa incluso si falla un envío
    colaBLE = operacion.catch(error => {
        console.error("Error en cola BLE:", error);
    });

    try {

        const resultado = await operacion;

        console.log(
            "TIEMPO TOTAL DEL COMANDO:",
            orden,
            (performance.now() - inicio).toFixed(2),
            "ms"
        );

        return resultado;

    } catch (error) {

        console.error("ERROR BLE:", error);

        registrarActividad("Error BLE: " + error.message);

        return false;
    }
}



// =====================================
// ENVIAR ESTADOS AL ESP32
// =====================================


async function enviarEstadoRobot(estado) {

    if (!robotCharacteristic || !robotDevice?.gatt.connected) {
        return false;
    }

    const orden = estado.trim().toUpperCase();

    const operacion = colaBLE.then(async () => {

        if (!robotCharacteristic || !robotDevice?.gatt.connected) {
            throw new Error("Bluetooth desconectado");
        }

        const datos = new TextEncoder().encode(orden);

        if (typeof robotCharacteristic.writeValueWithResponse === "function") {

            await robotCharacteristic.writeValueWithResponse(datos);

        } else {

            await robotCharacteristic.writeValue(datos);
        }

        console.log("ESTADO BLE ENVIADO:", orden);

        return true;
    });

    colaBLE = operacion.catch(error => {
        console.error("Error enviando estado BLE:", error);
    });

    try {

        return await operacion;

    } catch (error) {

        console.error("Error enviando estado:", error);

        return false;
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
// GENERAR DATOS DEL RELOJ
// =====================================


function obtenerPaqueteReloj() {

    const ahora = new Date();

    const hora = new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).format(ahora);

    const fecha = new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(ahora);

    return `CLOCK|${hora}|${fecha}`;
}



// =====================================
// ENVIAR DATOS DEL RELOJ POR BLE
// =====================================

async function enviarDatosReloj() {

    if (!robotCharacteristic || !robotDevice?.gatt.connected) {
        return false;
    }

    const paquete = obtenerPaqueteReloj();

    const operacion = colaBLE.then(async () => {

        if (!robotCharacteristic || !robotDevice?.gatt.connected) {
            throw new Error("Bluetooth desconectado");
        }

        // No convertir a mayúsculas ni modificar el paquete
        const datos = new TextEncoder().encode(paquete);

        if (
            typeof robotCharacteristic.writeValueWithResponse === "function"
        ) {

            await robotCharacteristic.writeValueWithResponse(datos);

        } else {

            await robotCharacteristic.writeValue(datos);
        }

        console.log("RELOJ BLE ENVIADO:", paquete);

        return true;
    });

    colaBLE = operacion.catch(error => {
        console.error("Error en cola BLE:", error);
    });

    try {

        return await operacion;

    } catch (error) {

        console.error("ERROR ENVIANDO RELOJ:", error);

        registrarActividad(
            "Error enviando reloj: " + error.message
        );

        return false;
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
// UNIR TRANSCRIPCIONES SIN REPETICIONES
// =====================================

function unirSegmentosSinRepetir(segmentos) {

    const palabrasFinales = [];

    for (const segmento of segmentos) {

        if (!segmento) continue;

        const nuevasPalabras = segmento.trim().split(/\s+/);

        const normalizadasNuevas = nuevasPalabras.map(
            palabra => normalizarTexto(palabra)
        );

        let solapamiento = 0;

        const maximo = Math.min(
            palabrasFinales.length,
            nuevasPalabras.length,
            12
        );

        for (let cantidad = maximo; cantidad >= 1; cantidad--) {

            const anteriores = palabrasFinales
                .slice(-cantidad)
                .map(palabra => normalizarTexto(palabra));

            const siguientes = normalizadasNuevas.slice(0, cantidad);

            if (
                anteriores.every(
                    (palabra, indice) =>
                        palabra === siguientes[indice]
                )
            ) {
                solapamiento = cantidad;
                break;
            }
        }

        palabrasFinales.push(
            ...nuevasPalabras.slice(solapamiento)
        );
    }

    return palabrasFinales.join(" ");
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


function mostrarHoraRobot() {

    // Evitar intervalos duplicados
    if (intervaloRelojOLED !== null) {
        clearInterval(intervaloRelojOLED);
        intervaloRelojOLED = null;
    }

    mostrandoReloj = true;

    // Activar pantalla del reloj
    mostrarHoraRobot();

    // Enviar hora inmediatamente
    enviarDatosReloj();

    // Actualizar cada segundo indefinidamente
    intervaloRelojOLED = setInterval(() => {

        if (!robotCharacteristic) {
            clearInterval(intervaloRelojOLED);
            intervaloRelojOLED = null;
            return;
        }

        enviarDatosReloj();

    }, 1000);
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

        console.log(
            "BOTON PULSADO:",
            comando,
            "TIEMPO:",
            performance.now()
        );

		if (comando !== "INFO") {

			clearTimeout(temporizadorRegresoRostro);
			clearInterval(intervaloRelojOLED);

			temporizadorRegresoRostro = null;
			intervaloRelojOLED = null;

			mostrandoReloj = false;
		}

        const inicio = performance.now();

        await enviarComando(comando);

        console.log(
            "BOTON COMPLETADO:",
            comando,
            (performance.now() - inicio).toFixed(2),
            "ms"
        );
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
	segmentosFinales = [];

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

		// Guardar cada resultado definitivo por su índice
		for (let i = 0; i < event.results.length; i++) {

			const resultado = event.results[i];

			if (resultado.isFinal) {

				segmentosFinales[i] =
					resultado[0].transcript.trim();
			}
		}

		// Reconstruir el mensaje evitando fragmentos repetidos
		textoCapturado = unirSegmentosSinRepetir(
			segmentosFinales
		);

		// Mostrar también el resultado provisional
		let textoTemporal = "";

		for (let i = 0; i < event.results.length; i++) {

			const resultado = event.results[i];

			if (!resultado.isFinal) {

				textoTemporal += resultado[0].transcript + " ";
			}
		}

		const textoVisible = (
			textoCapturado + " " + textoTemporal
		).trim();

		cambiarTexto(
			textoEscuchado,
			textoVisible
				? "Tú: " + textoVisible
				: "Te estoy escuchando..."
		);

		console.log(
			"TRANSCRIPCION DEFINITIVA:",
			textoCapturado
		);

		console.log(
			"TRANSCRIPCION VISIBLE:",
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
		segmentosFinales = [];

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


async function consultarMiniRobot(mensaje, alRecibirTexto) {

    const inicio = performance.now();

    const respuesta = await fetch("/api/chat", {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            mensaje: mensaje
        })
    });

    if (!respuesta.ok) {

        let error = {};

        try {
            error = await respuesta.json();
        } catch {}

        throw new Error(
            error.error || "No se pudo conectar con la IA"
        );
    }

    if (!respuesta.body) {
        throw new Error("El navegador no admite Streaming.");
    }

    const reader = respuesta.body.getReader();

    const decoder = new TextDecoder();

    let buffer = "";
    let respuestaCompleta = "";
    let primeraRespuesta = false;

    while (true) {

        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, {
            stream: true
        });

        const eventos = buffer.split(/\r?\n\r?\n/);

        buffer = eventos.pop() || "";

        for (const evento of eventos) {

            const lineas = evento.split(/\r?\n/);

            for (const linea of lineas) {

                if (!linea.startsWith("data:")) continue;

                const contenido = linea.slice(5).trim();

                if (!contenido || contenido === "[DONE]") {
                    continue;
                }

                try {

                    const datos = JSON.parse(contenido);

                    const fragmento =
                        datos.choices?.[0]?.delta?.content;

                    if (typeof fragmento === "string" && fragmento) {

                        if (!primeraRespuesta) {

                            primeraRespuesta = true;

                            console.log(
                                "Primera respuesta en:",
                                ((performance.now() - inicio) / 1000).toFixed(2),
                                "segundos"
                            );
                        }

                        respuestaCompleta += fragmento;

                        if (alRecibirTexto) {
                            alRecibirTexto(respuestaCompleta);
                        }
                    }

                } catch (error) {

                    console.error("Error leyendo fragmento:", error);
                }
            }
        }
    }

    respuestaCompleta = respuestaCompleta.trim();

    if (!respuestaCompleta) {

        throw new Error("La IA no devolvió una respuesta.");
    }

    console.log(
        "Tiempo total IA:",
        ((performance.now() - inicio) / 1000).toFixed(2),
        "segundos"
    );

    return respuestaCompleta;
}



// =====================================
// PROCESAR MENSAJE DEL USUARIO
// =====================================


async function procesarMensajeUsuario(mensaje) {

    const texto = mensaje.trim();

    if (!texto) return;

    console.log("PROCESANDO MENSAJE:", texto);

    if (esSolicitudHora(texto)) {

        registrarActividad(
            "COMANDO ESPECIAL: MOSTRAR RELOJ"
        );

        await mostrarHoraRobot();

        return;
    }

	clearTimeout(temporizadorRegresoRostro);
	clearInterval(intervaloRelojOLED);

	temporizadorRegresoRostro = null;
	intervaloRelojOLED = null;

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

        const respuesta = await consultarMiniRobot(
            texto,
            function(textoParcial) {

                cambiarTexto(
                    respuestaElemento,
                    "MINI ROBOT: " + textoParcial
                );

                cambiarTexto(
                    robotMessage,
                    "GENERANDO RESPUESTA"
                );

                cambiarTexto(
                    robotSubmessage,
                    "Estoy preparando mi respuesta..."
                );
            }
        );

        cambiarTexto(
            respuestaElemento,
            "MINI ROBOT: " + respuesta
        );

        cambiarTexto(robotMessage, "NUEVA RESPUESTA");

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

iniciarAutenticacion();