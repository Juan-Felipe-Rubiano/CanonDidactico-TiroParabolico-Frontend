import { useState, useRef, useEffect } from "react";
// Se elimina la importación de "./api.js" para resolver el error de resolución de módulo.

// URL del backend de Spring Boot (constante de la API)
const API_URL = "http://localhost:8080/control";

function App() {
    // --- ESTADO EXISTENTE ---
    const [angulo, setAngulo] = useState(0);
    const [tension, setTension] = useState(0);
    const [contador, setContador] = useState(0);
    const [tensionando, setTensionando] = useState(false);
    const [confirmado, setConfirmado] = useState(false);
    const intervalRef = useRef(null);

    // --- NUEVO ESTADO: CONTROL DE IMPACTO ---
    const [impacto, setImpacto] = useState(false); // Bandera para mostrar la notificación

    // ------------------------------------------------------------------
    // FUNCIÓN: CONEXIÓN Y ESCUCHA DE WEBSOCKET
    // ------------------------------------------------------------------
    useEffect(() => {
        // Inicializa la conexión WS al endpoint de Spring Boot
        const ws = new WebSocket("ws://localhost:8080/ws/fsr");

        ws.onopen = () => {
            console.log("Conectado al WebSocket del FSR. Escuchando impactos...");
        };

        // Maneja los mensajes entrantes desde el backend
        ws.onmessage = (event) => {
            console.log("Mensaje WS recibido:", event.data);

            // Si el backend envía la señal de impacto, activamos la bandera
            if (event.data === "Impacto detectado") {
                setImpacto(true);
                // Opcional: Ocultamos el mensaje de impacto después de 5 segundos
                setTimeout(() => setImpacto(false), 5000);
            }
        };

        ws.onclose = () => {
            console.log("Desconectado del WebSocket.");
        };

        // Función de limpieza: Cierra la conexión WS al desmontar el componente
        return () => {
            ws.close();
        };
    }, []); // El array vacío asegura que esto solo se ejecute una vez al montar

    // --- FUNCIONES EXISTENTES ---
    const iniciarTension = () => {
        setTensionando(true);
        setConfirmado(false);
        setContador(0);
        // Función: Inicia el contador de tiempo al presionar el botón
        intervalRef.current = setInterval(() => {
            setContador((prev) => prev + 1);
        }, 1000);
    };

    const soltarTension = () => {
        // Función: Detiene el contador al soltar el botón y establece la tensión
        clearInterval(intervalRef.current);
        setTensionando(false);
        setTension(contador);
    };

    // ------------------------------------------------------------------
    // FUNCIÓN CORREGIDA: ENVÍO DE DATOS INLINE (usando fetch)
    // ------------------------------------------------------------------
    const confirmarEnvio = async () => {
        // Función: Envía los valores de ángulo y tensión al backend via REST (fetch)
        try {
            // Se usa fetch y se pasan los parámetros en la URL (Query Params)
            const url = `${API_URL}/servos?angulo=${angulo}&tension=${tension}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
                // No se necesita body ya que los datos van en la URL (POST con QueryParams)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const resp = await response.text();
            console.log("Respuesta del backend:", resp);
            setConfirmado(true);
        } catch (e) {
            console.error("Error enviando datos al backend:", e);
        }
    };

    // --- ESTILOS MEJORADOS ---
    const buttonStyle = (isTensioning) => ({
        padding: "15px 35px",
        fontSize: "18px",
        cursor: isTensioning ? "not-allowed" : "pointer",
        background: isTensioning ? "#aaa" : "#e67e22", // Color naranja para la tensión
        color: "white",
        border: "none",
        borderRadius: "10px",
        transition: "0.2s",
        boxShadow: isTensioning ? "none" : "0 4px 6px rgba(0, 0, 0, 0.1)",
        fontWeight: "bold",
    });

    return (
        <div
            className="AppContainer"
            style={{
                textAlign: "center",
                padding: "50px 20px",
                fontFamily: "'Inter', sans-serif",
                background: "#f5f6fa",
                minHeight: "100vh",
            }}
        >
            <h1 style={{ color: "#2c3e50", marginBottom: '30px' }}>Control del Cañón</h1>

            {/* --- INDICADOR DE IMPACTO EN TIEMPO REAL --- */}
            {impacto && (
                <div
                    style={{
                        padding: "20px",
                        background: "#e74c3c", // Rojo fuerte
                        color: "white",
                        fontSize: "24px",
                        fontWeight: "bold",
                        borderRadius: "12px",
                        margin: "20px auto",
                        maxWidth: "400px",
                        boxShadow: "0 6px 12px rgba(231, 76, 60, 0.5)",
                        animation: 'flash 0.5s infinite alternate' // Animación CSS simple (ver más abajo)
                    }}
                >
                    💥 ¡OBJETIVO ALCANZADO! 💥
                </div>
            )}

            {/* Pequeño hack para la animación flash en JS */}
            <style>
                {`
                @keyframes flash {
                    from { transform: scale(1); opacity: 1; }
                    to { transform: scale(1.05); opacity: 0.9; }
                }
                `}
            </style>


            {/* SLIDER DE ÁNGULO */}
            <div style={{ margin: "40px auto", width: "80%", maxWidth: "400px", background: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <label style={{ display: "block", marginBottom: "15px", fontSize: "18px", color: '#34495e' }}>
                    Ángulo de Inclinación: <strong>{angulo}°</strong>
                </label>
                {/* Nota: Se mantiene max="90" por tu diseño inicial, pero el ESP soporta 180 */}
                <input
                    type="range"
                    min="0"
                    max="90"
                    value={angulo}
                    onChange={(e) => setAngulo(Number(e.target.value))} // Asegura que sea número
                    style={{ width: "100%" }}
                />
            </div>

            {/* BOTÓN DE TENSIÓN */}
            <div style={{ margin: "40px auto" }}>
                <button
                    onMouseDown={iniciarTension}
                    onMouseUp={soltarTension}
                    onMouseLeave={soltarTension}
                    disabled={tensionando}
                    style={buttonStyle(tensionando)}
                >
                    {/* Mensaje dinámico */}
                    {tensionando ? `Tensionando... ${contador}s` : "Oprime y mantén para tensionar"}
                </button>
            </div>

            {/* CONFIRMACIÓN Y ENVÍO */}
            {!tensionando && tension > 0 && !confirmado && (
                <div style={{ marginTop: "25px", background: '#ecf0f1', padding: '20px', borderRadius: '10px', maxWidth: '400px', margin: '20px auto' }}>
                    <p style={{ fontSize: "18px", color: '#2c3e50' }}>Tensión registrada: <strong>{tension} segundos</strong></p>
                    <button
                        onClick={confirmarEnvio}
                        style={{
                            padding: "12px 30px",
                            fontSize: "16px",
                            background: "#2ecc71", // Verde para enviar
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            marginTop: "10px",
                            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                        }}
                    >
                        Enviar Comando (Ángulo y Tensión)
                    </button>
                </div>
            )}

            {confirmado && (
                <p style={{ color: "#27ae60", marginTop: "20px", fontSize: "18px", fontWeight: 'bold' }}>
                    Comando enviado correctamente al ESP.
                </p>
            )}
        </div>
    );
}

export default App;
