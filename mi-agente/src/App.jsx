import { useEffect, useState } from "react";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import "./App.css";

/* =========================================================
   VARIABLES DE ENTORNO
   ========================================================= */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* =========================================================
   CLIENTES EXTERNOS
   ========================================================= */

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* =========================================================
   SYSTEM INSTRUCTION DE MENTORIA
   ========================================================= */

const SYSTEM_INSTRUCTION = `
Eres MentorIA, un asesor docente experto en Agentes Inteligentes,
desarrollo web e ingeniería.

Tu misión no es simplemente responder preguntas, sino ayudar al
estudiante a aprender mientras construye su proyecto.

COMPORTAMIENTO DOCENTE

1. Antes de entregar una solución completa, analiza qué sabe el estudiante.

2. Cuando sea conveniente, haz una pregunta corta que permita comprobar
su comprensión.

3. Da primero pistas y explicaciones antes de resolver completamente
un problema.

4. Relaciona tus respuestas con conceptos que el estudiante ya haya
aprendido.

5. Cuando aparezca un concepto importante, destaca brevemente:

💡 Lo que estamos aprendiendo:

6. Si detectas un error conceptual, corrígelo claramente y explica por qué.

7. No felicites automáticamente. Reconoce un logro solamente cuando exista
evidencia de que fue conseguido.


COMANDO: REGAÑO:

Cuando el mensaje del estudiante comience por:

Regaño:

debes interpretar el resto del mensaje como una crítica a tu comportamiento.

Debes responder utilizando esta estructura:

🛠️ REGAÑO RECIBIDO

Problema detectado:
[explica brevemente qué hiciste mal]

Ajuste:
[indica cómo cambiarás tu comportamiento]

Regla aprendida:
[formula una regla concreta que aplicarás en adelante]

Después debes aplicar ese ajuste en las respuestas siguientes.


COMANDO: IMPLEMENTADO:

Cuando el mensaje comience por:

Implementado:

significa que el estudiante afirma haber realizado una modificación
o completado una parte del proyecto.

Debes actualizar el ESPEJO DEL PROYECTO.

El espejo distingue:

✅ Implementado
🟡 En desarrollo
⬜ Pendiente

Nunca marques algo como implementado si el estudiante no lo ha informado
o si no existe evidencia suficiente.

Cuando recibas un nuevo "Implementado:", responde brevemente y muestra
principalmente las partes del espejo que hayan cambiado.


ESPEJO ACTUAL DEL PROYECTO

✅ Repositorio GitHub
✅ GitHub Codespaces
✅ System Instruction
✅ API de Gemini
✅ Proyecto Supabase
✅ Tabla conversaciones
✅ Proyecto React + Vite
✅ Variables de entorno
✅ Integración Gemini
✅ Integración Supabase
✅ Historial con localStorage
✅ Nuevo Chat
✅ Borrar sesión
✅ Renderizado Markdown
✅ Copiar respuesta
✅ Micrófono
🟡 Pruebas finales
✅ Git commit/push
⬜ Despliegue Vercel
⬜ Prueba externa


EVALUACIÓN DEL APRENDIZAJE

Periódicamente puedes realizar una pregunta corta relacionada con lo
que el estudiante acaba de hacer.

No conviertas cada conversación en un examen.

Cuando el estudiante demuestre dominio suficiente de varios conceptos
importantes puedes indicar:

🎓 NIVEL SUPERADO

y explicar brevemente qué conocimientos demostró.

Solo entrega un "Diploma simbólico de dominio" cuando exista evidencia
suficiente de comprensión de:

- Git y GitHub
- Codespaces
- React y Vite
- API
- Gemini
- Supabase
- variables de entorno
- desarrollo vs producción
- Vercel


ESTILO

Sé claro, crítico, amigable y conciso.

Usa Markdown cuando mejore la explicación.

Evita respuestas innecesariamente largas.

No inventes que una funcionalidad está implementada.

Diferencia entre hechos, hipótesis y recomendaciones cuando exista
incertidumbre.
`;

/* =========================================================
   APLICACIÓN
   ========================================================= */

function App() {

  /* ---------------------------------------------------------
     ESTADOS
     --------------------------------------------------------- */

  const [mensajes, setMensajes] = useState(() => {
    try {
      const guardados = localStorage.getItem("mentoria-chat");
      return guardados ? JSON.parse(guardados) : [];
    } catch {
      return [];
    }
  });

  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);

  /* ---------------------------------------------------------
     GUARDAR CHAT EN LOCALSTORAGE
     --------------------------------------------------------- */

  useEffect(() => {
    localStorage.setItem(
      "mentoria-chat",
      JSON.stringify(mensajes)
    );
  }, [mensajes]);

  /* =========================================================
     ENVIAR MENSAJE
     ========================================================= */

  const enviarMensaje = async () => {

    const pregunta = entrada.trim();

    if (!pregunta || cargando) return;

    /* -------------------------------------------------------
       MEMORIA CONVERSACIONAL PARA GEMINI
       ------------------------------------------------------- */

    const historialGemini = mensajes
      .filter(
        (mensaje) =>
          mensaje.texto &&
          !mensaje.texto.startsWith("⚠️")
      )
      .map((mensaje) => ({
        role:
          mensaje.rol === "usuario"
            ? "user"
            : "model",

        parts: [
          {
            text: mensaje.texto,
          },
        ],
      }));

    const contenidos = [
      ...historialGemini,
      {
        role: "user",
        parts: [
          {
            text: pregunta,
          },
        ],
      },
    ];

    /* -------------------------------------------------------
       MOSTRAR MENSAJE DEL USUARIO
       ------------------------------------------------------- */

    const mensajeUsuario = {
      rol: "usuario",
      texto: pregunta,
    };

    setMensajes((prev) => [
      ...prev,
      mensajeUsuario,
    ]);

    setEntrada("");
    setCargando(true);

    try {

      /* -----------------------------------------------------
         MODELOS DE RESPALDO
         ----------------------------------------------------- */

      const modelos = [
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
      ];

      let respuesta = null;
      let ultimoError = null;

      /* -----------------------------------------------------
         FALLBACK ENTRE MODELOS + REINTENTOS
         ----------------------------------------------------- */

      for (const modelo of modelos) {

        for (
          let intento = 0;
          intento < 3;
          intento++
        ) {

          try {

            const response =
              await ai.models.generateContent({
                model: modelo,

                contents: contenidos,

                config: {
                  systemInstruction:
                    SYSTEM_INSTRUCTION,
                },
              });

            respuesta = response.text;

            console.log(
              `Respuesta obtenida con: ${modelo}`
            );

            break;

          } catch (error) {

            ultimoError = error;

            const mensajeError =
              error?.message || "";

            const esTemporal =
              error?.status === 503 ||
              error?.status === 429 ||
              mensajeError.includes("503") ||
              mensajeError.includes("429");

            const modeloNoDisponible =
              error?.status === 404 ||
              mensajeError.includes("404");

            /* -----------------------------------------------
               SI EL MODELO NO EXISTE PARA ESTA CUENTA,
               PASAMOS AL SIGUIENTE
               ----------------------------------------------- */

            if (modeloNoDisponible) {

              console.warn(
                `${modelo} no disponible para esta cuenta. Probando modelo alternativo.`
              );

              break;
            }

            /* -----------------------------------------------
               OTROS ERRORES NO TEMPORALES
               ----------------------------------------------- */

            if (!esTemporal) {
              throw error;
            }

            console.warn(
              `${modelo} no disponible. Intento ${
                intento + 1
              }/3`
            );

            /* -----------------------------------------------
               BACKOFF EXPONENCIAL + JITTER
               ----------------------------------------------- */

            const espera =
              1000 *
                Math.pow(2, intento) +
              Math.random() * 500;

            await new Promise((resolve) =>
              setTimeout(resolve, espera)
            );
          }
        }

        if (respuesta) {
          break;
        }
      }

      if (!respuesta) {
        throw ultimoError;
      }

      /* -----------------------------------------------------
         MOSTRAR RESPUESTA
         ----------------------------------------------------- */

      const mensajeIA = {
        rol: "agente",
        texto: respuesta,
      };

      setMensajes((prev) => [
        ...prev,
        mensajeIA,
      ]);

      /* -----------------------------------------------------
         GUARDAR CONVERSACIÓN EN SUPABASE
         ----------------------------------------------------- */

      const { error: errorSupabase } =
        await supabase
          .from("conversaciones")
          .insert([
            {
              pregunta,
              respuesta,
            },
          ]);

      if (errorSupabase) {

        console.error(
          "Error Supabase:",
          errorSupabase
        );

      } else {

        console.log(
          "Conversación guardada en Supabase"
        );
      }

    } catch (error) {

      console.error(
        "Error al consultar MentorIA:",
        error
      );

      setMensajes((prev) => [
        ...prev,
        {
          rol: "agente",
          texto:
            "⚠️ En este momento no pude comunicarme correctamente con el servicio de IA. Puedes intentar nuevamente en unos segundos.",
        },
      ]);

    } finally {

      setCargando(false);

    }
  };

  /* =========================================================
     NUEVO CHAT
     ========================================================= */

  const nuevoChat = () => {

    setMensajes([]);

    localStorage.removeItem(
      "mentoria-chat"
    );
  };

  /* =========================================================
     BORRAR SESIÓN
     ========================================================= */

  const borrarSesion = () => {

    localStorage.removeItem(
      "mentoria-chat"
    );

    setMensajes([]);

    setEntrada("");
  };

  /* =========================================================
     COPIAR RESPUESTA
     ========================================================= */

  const copiarRespuesta = async (texto) => {

    try {

      await navigator.clipboard.writeText(
        texto
      );

    } catch (error) {

      console.error(
        "No fue posible copiar:",
        error
      );
    }
  };

  /* =========================================================
     RECONOCIMIENTO DE VOZ
     ========================================================= */

  const escucharVoz = () => {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

      alert(
        "Tu navegador no soporta reconocimiento de voz."
      );

      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang = "es-CO";

    recognition.interimResults = false;

    recognition.continuous = false;

    recognition.onstart = () => {

      setEscuchando(true);

    };

    recognition.onresult = (event) => {

      const texto =
        event.results[0][0].transcript;

      setEntrada(texto);

    };

    recognition.onerror = (event) => {

      console.error(
        "Error de reconocimiento de voz:",
        event.error
      );

      setEscuchando(false);
    };

    recognition.onend = () => {

      setEscuchando(false);

    };

    recognition.start();
  };

  /* =========================================================
     ENTER PARA ENVIAR
     SHIFT + ENTER PARA SALTO DE LÍNEA
     ========================================================= */

  const manejarTecla = (event) => {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      enviarMensaje();
    }
  };

  /* =========================================================
     INTERFAZ
     ========================================================= */

  return (
    <div className="app">

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside className="sidebar">

        <div>

          <h1>MentorIA</h1>

          <p className="subtitulo">
            Aprende construyendo
          </p>

          <button
            className="nuevo-chat"
            onClick={nuevoChat}
          >
            + Nuevo chat
          </button>

          <div className="estado">

            <h3>Proyecto</h3>

            <p>✅ GitHub</p>

            <p>✅ Codespaces</p>

            <p>
              ✅ System Instruction
            </p>

            <p>✅ React + Vite</p>

            <p>✅ Supabase</p>

            <p>
              ✅ Integración del agente
            </p>

            <p>⬜ Vercel</p>

          </div>

        </div>

        <button
          className="borrar"
          onClick={borrarSesion}
        >
          Borrar sesión
        </button>

      </aside>

      {/* =====================================================
          CHAT
          ===================================================== */}

      <main className="chat">

        {/* ---------------------------------------------------
            HEADER
            --------------------------------------------------- */}

        <header className="chat-header">

          <div>

            <h2>MentorIA</h2>

            <span>
              Tu tutor de Agentes Inteligentes
            </span>

          </div>

          <div className="estado-online">

            <span className="punto"></span>

            En línea

          </div>

        </header>

        {/* ---------------------------------------------------
            MENSAJES
            --------------------------------------------------- */}

        <section className="mensajes">

          {mensajes.length === 0 && (

            <div className="bienvenida">

              <div className="logo-grande">
                🤖
              </div>

              <h2>
                Hola, soy MentorIA
              </h2>

              <p>
                No quiero darte simplemente
                las respuestas. Quiero ayudarte
                a entender lo que estás
                construyendo.
              </p>

              <div className="comandos">

                <span>
                  <strong>
                    Regaño:
                  </strong>{" "}
                  corrige mi forma de ayudarte
                </span>

                <span>
                  <strong>
                    Implementado:
                  </strong>{" "}
                  actualiza el avance
                </span>

              </div>

            </div>

          )}

          {mensajes.map(
            (mensaje, index) => (

              <div
                key={index}
                className={`mensaje ${
                  mensaje.rol === "usuario"
                    ? "usuario"
                    : "agente"
                }`}
              >

                <div className="burbuja">

                  {mensaje.rol ===
                  "agente" ? (

                    <>

                      <ReactMarkdown>
                        {mensaje.texto}
                      </ReactMarkdown>

                      <button
                        className="copiar"
                        onClick={() =>
                          copiarRespuesta(
                            mensaje.texto
                          )
                        }
                      >
                        Copiar
                      </button>

                    </>

                  ) : (

                    mensaje.texto

                  )}

                </div>

              </div>

            )
          )}

          {cargando && (

            <div className="mensaje agente">

              <div className="burbuja escribiendo">

                MentorIA está pensando...

              </div>

            </div>

          )}

        </section>

        {/* ===================================================
            CAJA DE ENTRADA
            =================================================== */}

        <footer className="entrada">

          <button
            className="microfono"
            onClick={escucharVoz}
            disabled={cargando}
            title="Hablar con MentorIA"
          >
            {escuchando ? "🔴" : "🎤"}
          </button>

          <textarea
            value={entrada}
            onChange={(event) =>
              setEntrada(
                event.target.value
              )
            }
            onKeyDown={manejarTecla}
            placeholder={
              escuchando
                ? "Escuchando..."
                : "Pregúntale algo a MentorIA..."
            }
            rows="1"
          />

          <button
            onClick={enviarMensaje}
            disabled={cargando}
          >
            {cargando
              ? "Pensando..."
              : "Enviar"}
          </button>

        </footer>

      </main>

    </div>
  );
}

export default App;