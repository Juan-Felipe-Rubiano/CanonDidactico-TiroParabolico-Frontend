import { useState, useRef, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, ScatterChart, Scatter, Cell, BarChart, Bar } from 'recharts';

const API_URL = "http://localhost:8080/control";

function App() {
    // --- ESTADO EXISTENTE ---
    const [angulo, setAngulo] = useState(0);
    const [tension, setTension] = useState(0);
    const [contador, setContador] = useState(0);
    const [tensionando, setTensionando] = useState(false);
    const [confirmado, setConfirmado] = useState(false);
    const intervalRef = useRef(null);
    const [impacto, setImpacto] = useState(false);
    const [graficoActivo, setGraficoActivo] = useState('trayectoria');

    // --- HISTORIAL DE DISPAROS ---
    const [historialDisparos, setHistorialDisparos] = useState([]);

    // --- NUEVO ESTADO: PARÁMETROS FÍSICOS ---
    const [parametros, setParametros] = useState({
        constanteResorte: 130.4, // N/m
        distanciaFSR: 100, // cm
        masaProyectil: 50, // gramos
        gravedad: 9.81, // m/s²
        alturaInicial: 0 // metros
    });

    // --- WEBSOCKET ---
    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8080/ws/fsr");

        ws.onopen = () => {
            console.log("Conectado al WebSocket del FSR. Escuchando impactos...");
        };

        ws.onmessage = (event) => {
            console.log("Mensaje WS recibido:", event.data);
            if (event.data === "Impacto detectado") {
                setImpacto(true);

                // Guardar disparo real en el historial
                const nuevoDisparo = {
                    angulo,
                    tension,
                    alcanceTeorico: trayectoria.alcance,
                    alcanceReal: parametros.distanciaFSR, // Asumimos que impactó en el FSR
                    timestamp: new Date().toLocaleTimeString()
                };
                setHistorialDisparos(prev => [...prev, nuevoDisparo]);

                // Cambiar automáticamente a la gráfica de comparación
                setGraficoActivo('comparacion');

                setTimeout(() => setImpacto(false), 5000);
            }
        };

        ws.onclose = () => {
            console.log("Desconectado del WebSocket.");
        };

        return () => {
            ws.close();
        };
    }, []);

    // --- FUNCIONES EXISTENTES ---
    const iniciarTension = () => {
        setTensionando(true);
        setConfirmado(false);
        setContador(0);
        intervalRef.current = setInterval(() => {
            setContador((prev) => prev + 1);
        }, 1000);
    };

    const soltarTension = () => {
        clearInterval(intervalRef.current);
        setTensionando(false);
        setTension(contador);
    };

    const confirmarEnvio = async () => {
        try {
            const url = `${API_URL}/servos?angulo=${angulo}&tension=${tension}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
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

    // --- FUNCIÓN: ACTUALIZAR PARÁMETROS ---
    const actualizarParametro = (key, value) => {
        setParametros(prev => ({
            ...prev,
            [key]: parseFloat(value) || 0
        }));
    };

    // --- CÁLCULOS DE FÍSICA: TIRO PARABÓLICO ---
    const calcularTrayectoria = () => {
        // Energía potencial elástica: E = (1/2) * k * x²
        // Asumimos que la compresión x es propproporcional al tiempo de tensión
        // Por ejemplo: x = tension * 0.01 metros (1cm por segundo de tensión)
        const compresion = tension * 0.01; // metros
        const energiaPotencial = 0.5 * parametros.constanteResorte * Math.pow(compresion, 2); // Joules

        // Energía cinética inicial: E = (1/2) * m * v²
        // m en kg: masaProyectil / 1000
        const masaKg = parametros.masaProyectil / 1000;
        const velocidadInicial = Math.sqrt((2 * energiaPotencial) / masaKg); // m/s

        // Componentes de velocidad
        const anguloRad = (angulo * Math.PI) / 180;
        const vx = velocidadInicial * Math.cos(anguloRad);
        const vy = velocidadInicial * Math.sin(anguloRad);

        // Tiempo de vuelo hasta tocar el suelo (y = 0)
        // y = y0 + vy*t - (1/2)*g*t²
        // Usando fórmula cuadrática: t = (vy + sqrt(vy² + 2*g*y0)) / g
        const tiempoVuelo = (vy + Math.sqrt(vy * vy + 2 * parametros.gravedad * parametros.alturaInicial)) / parametros.gravedad;

        // Alcance horizontal
        const alcance = vx * tiempoVuelo; // metros

        // Generar puntos de la trayectoria
        const puntos = [];
        const numPuntos = 50;
        for (let i = 0; i <= numPuntos; i++) {
            const t = (tiempoVuelo * i) / numPuntos;
            const x = vx * t;
            const y = parametros.alturaInicial + vy * t - 0.5 * parametros.gravedad * t * t;

            if (y >= 0) {
                puntos.push({
                    x: parseFloat((x * 100).toFixed(2)), // Convertir a cm y redondear a 2 decimales
                    y: parseFloat((y * 100).toFixed(2))  // Convertir a cm y redondear a 2 decimales
                });
            }
        }

        return {
            puntos,
            alcance: alcance * 100, // en cm
            velocidadInicial,
            tiempoVuelo
        };
    };

    const trayectoria = calcularTrayectoria();
    const daAlObjetivo = Math.abs(trayectoria.alcance - parametros.distanciaFSR) <= 3; // Margen de ±3cm

    // --- CÁLCULOS ADICIONALES PARA GRÁFICAS ---

    // 1. VELOCIDAD VS TIEMPO
    const calcularVelocidades = () => {
        const puntos = [];
        const anguloRad = (angulo * Math.PI) / 180;
        const compresion = tension * 0.01;
        const energiaPotencial = 0.5 * parametros.constanteResorte * Math.pow(compresion, 2);
        const masaKg = parametros.masaProyectil / 1000;
        const velocidadInicial = Math.sqrt((2 * energiaPotencial) / masaKg);
        const vx = velocidadInicial * Math.cos(anguloRad);
        const vy = velocidadInicial * Math.sin(anguloRad);
        const tiempoVuelo = (vy + Math.sqrt(vy * vy + 2 * parametros.gravedad * parametros.alturaInicial)) / parametros.gravedad;

        for (let i = 0; i <= 50; i++) {
            const t = (tiempoVuelo * i) / 50;
            const vyActual = vy - parametros.gravedad * t;
            const vTotal = Math.sqrt(vx * vx + vyActual * vyActual);
            puntos.push({
                t: parseFloat(t.toFixed(2)),
                vx: parseFloat(vx.toFixed(2)),
                vy: parseFloat(vyActual.toFixed(2)),
                vTotal: parseFloat(vTotal.toFixed(2))
            });
        }
        return puntos;
    };

    // 2. ENERGÍA VS TIEMPO
    const calcularEnergias = () => {
        const puntos = [];
        const anguloRad = (angulo * Math.PI) / 180;
        const compresion = tension * 0.01;
        const energiaPotencial = 0.5 * parametros.constanteResorte * Math.pow(compresion, 2);
        const masaKg = parametros.masaProyectil / 1000;
        const velocidadInicial = Math.sqrt((2 * energiaPotencial) / masaKg);
        const vx = velocidadInicial * Math.cos(anguloRad);
        const vy = velocidadInicial * Math.sin(anguloRad);
        const tiempoVuelo = (vy + Math.sqrt(vy * vy + 2 * parametros.gravedad * parametros.alturaInicial)) / parametros.gravedad;

        for (let i = 0; i <= 50; i++) {
            const t = (tiempoVuelo * i) / 50;
            const y = parametros.alturaInicial + vy * t - 0.5 * parametros.gravedad * t * t;
            const vyActual = vy - parametros.gravedad * t;
            const vTotal = Math.sqrt(vx * vx + vyActual * vyActual);
            const eCinetica = 0.5 * masaKg * vTotal * vTotal;
            const ePotencial = masaKg * parametros.gravedad * y;
            const eTotal = eCinetica + ePotencial;

            if (y >= 0) {
                puntos.push({
                    t: parseFloat(t.toFixed(2)),
                    cinetica: parseFloat(eCinetica.toFixed(2)),
                    potencial: parseFloat(ePotencial.toFixed(2)),
                    total: parseFloat(eTotal.toFixed(2))
                });
            }
        }
        return puntos;
    };

    // 3. MAPA DE CALOR: ÁNGULO VS TENSIÓN
    const calcularMapaCalor = () => {
        const datos = [];
        for (let ang = 0; ang <= 90; ang += 5) {
            for (let tens = 1; tens <= 10; tens += 1) {
                const compresion = tens * 0.01;
                const energiaPotencial = 0.5 * parametros.constanteResorte * Math.pow(compresion, 2);
                const masaKg = parametros.masaProyectil / 1000;
                const velocidadInicial = Math.sqrt((2 * energiaPotencial) / masaKg);
                const anguloRad = (ang * Math.PI) / 180;
                const vx = velocidadInicial * Math.cos(anguloRad);
                const vy = velocidadInicial * Math.sin(anguloRad);
                const tiempoVuelo = (vy + Math.sqrt(vy * vy + 2 * parametros.gravedad * parametros.alturaInicial)) / parametros.gravedad;
                const alcance = vx * tiempoVuelo * 100;
                const acierta = Math.abs(alcance - parametros.distanciaFSR) <= 3;

                datos.push({
                    angulo: ang,
                    tension: tens,
                    alcance: parseFloat(alcance.toFixed(2)),
                    acierta
                });
            }
        }
        return datos;
    };

    // 4. TIEMPO DE VUELO VS ÁNGULO
    const calcularTiempoVueloVsAngulo = () => {
        const puntos = [];
        for (let ang = 0; ang <= 90; ang += 2) {
            const compresion = tension * 0.01;
            const energiaPotencial = 0.5 * parametros.constanteResorte * Math.pow(compresion, 2);
            const masaKg = parametros.masaProyectil / 1000;
            const velocidadInicial = Math.sqrt((2 * energiaPotencial) / masaKg);
            const anguloRad = (ang * Math.PI) / 180;
            const vy = velocidadInicial * Math.sin(anguloRad);
            const tiempoVuelo = (vy + Math.sqrt(vy * vy + 2 * parametros.gravedad * parametros.alturaInicial)) / parametros.gravedad;

            puntos.push({
                angulo: ang,
                tiempo: parseFloat(tiempoVuelo.toFixed(3))
            });
        }
        return puntos;
    };

    // --- ESTILOS ---
    const buttonStyle = (isTensioning) => ({
        padding: "15px 35px",
        fontSize: "18px",
        cursor: isTensioning ? "not-allowed" : "pointer",
        background: isTensioning ? "#aaa" : "#e67e22",
        color: "white",
        border: "none",
        borderRadius: "10px",
        transition: "0.2s",
        boxShadow: isTensioning ? "none" : "0 4px 6px rgba(0, 0, 0, 0.1)",
        fontWeight: "bold",
    });

    return (
        <div style={{
            display: "flex",
            minHeight: "100vh",
            background: "#f5f6fa",
            fontFamily: "'Inter', sans-serif",
            gap: "20px",
            padding: "20px"
        }}>
            <style>
                {`
                @keyframes flash {
                    from { transform: scale(1); opacity: 1; }
                    to { transform: scale(1.05); opacity: 0.9; }
                }
                `}
            </style>

            {/* PANEL IZQUIERDO: CONTROL */}
            <div style={{
                flex: 1,
                background: "white",
                borderRadius: "15px",
                padding: "40px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                textAlign: "center"
            }}>
                <h1 style={{ color: "#2c3e50", marginBottom: '30px' }}>Control del Cañón</h1>

                {/* INDICADOR DE IMPACTO */}
                {impacto && (
                    <div style={{
                        padding: "20px",
                        background: "#e74c3c",
                        color: "white",
                        fontSize: "24px",
                        fontWeight: "bold",
                        borderRadius: "12px",
                        margin: "20px auto",
                        maxWidth: "400px",
                        boxShadow: "0 6px 12px rgba(231, 76, 60, 0.5)",
                        animation: 'flash 0.5s infinite alternate'
                    }}>
                        💥 ¡OBJETIVO ALCANZADO! 💥
                    </div>
                )}

                {/* SLIDER DE ÁNGULO */}
                <div style={{
                    margin: "40px auto",
                    width: "100%",
                    maxWidth: "400px",
                    background: '#f8f9fa',
                    padding: '25px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                }}>
                    <label style={{
                        display: "block",
                        marginBottom: "15px",
                        fontSize: "18px",
                        color: '#34495e'
                    }}>
                        Ángulo de Inclinación: <strong style={{ color: '#e67e22' }}>{angulo}°</strong>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="180"
                        value={angulo}
                        onChange={(e) => setAngulo(Number(e.target.value))}
                        style={{ width: "100%", cursor: "pointer" }}
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
                        {tensionando ? `Tensionando... ${contador}s` : "Oprime y mantén para tensionar"}
                    </button>
                </div>

                {/* CONFIRMACIÓN Y ENVÍO */}
                {!tensionando && tension > 0 && !confirmado && (
                    <div style={{
                        marginTop: "25px",
                        background: '#ecf0f1',
                        padding: '20px',
                        borderRadius: '10px',
                        maxWidth: '400px',
                        margin: '20px auto'
                    }}>
                        <p style={{ fontSize: "18px", color: '#2c3e50' }}>
                            Tensión registrada: <strong>{tension} segundos</strong>
                        </p>
                        <button
                            onClick={confirmarEnvio}
                            style={{
                                padding: "12px 30px",
                                fontSize: "16px",
                                background: "#2ecc71",
                                color: "white",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                                marginTop: "10px",
                                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            }}
                        >
                            Enviar Comando
                        </button>
                    </div>
                )}

                {confirmado && (
                    <p style={{
                        color: "#27ae60",
                        marginTop: "20px",
                        fontSize: "18px",
                        fontWeight: 'bold'
                    }}>
                        ✓ Comando enviado correctamente al ESP.
                    </p>
                )}
            </div>

            {/* PANEL CENTRAL: GRÁFICA */}
            <div style={{
                flex: 1.2,
                background: "white",
                borderRadius: "15px",
                padding: "40px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                overflowY: "auto"
            }}>
                <h2 style={{
                    color: "#2c3e50",
                    marginBottom: '30px',
                    textAlign: 'center'
                }}>
                    Trayectoria Teórica
                </h2>

                {/* GRÁFICA DE TRAYECTORIA */}
                <div style={{
                    background: "#f8f9fa",
                    padding: "20px",
                    borderRadius: "12px",
                    marginBottom: "30px"
                }}>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={trayectoria.puntos} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="x"
                                label={{ value: 'Distancia (cm)', position: 'insideBottom', offset: -5 }}
                                domain={[0, 'dataMax']}
                            />
                            <YAxis
                                label={{ value: 'Altura (cm)', angle: -90, position: 'insideLeft' }}
                                domain={[0, 'dataMax']}
                            />
                            <Tooltip
                                formatter={(value) => `${value.toFixed(2)} cm`}
                                labelFormatter={(label) => `Distancia: ${label.toFixed(2)} cm`}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="y"
                                stroke="#e67e22"
                                strokeWidth={3}
                                name="Trayectoria"
                                dot={false}
                            />
                            <ReferenceLine
                                x={parametros.distanciaFSR}
                                stroke={daAlObjetivo ? "#2ecc71" : "#e74c3c"}
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{ value: 'Objetivo', position: 'top' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    {/* INDICADOR DE IMPACTO */}
                    <div style={{
                        marginTop: "15px",
                        padding: "12px 20px",
                        background: daAlObjetivo ? "#d5f4e6" : "#fadbd8",
                        borderLeft: `4px solid ${daAlObjetivo ? "#2ecc71" : "#e74c3c"}`,
                        borderRadius: "6px"
                    }}>
                        <p style={{
                            margin: 0,
                            color: daAlObjetivo ? "#27ae60" : "#c0392b",
                            fontWeight: "600",
                            fontSize: "15px"
                        }}>
                            {daAlObjetivo ? "✓ ¡Daría en el objetivo!" : "✗ No alcanzaría el objetivo"}
                        </p>
                        <p style={{
                            margin: "5px 0 0 0",
                            fontSize: "13px",
                            color: "#7f8c8d"
                        }}>
                            Alcance estimado: <strong>{trayectoria.alcance.toFixed(2)} cm</strong>
                            {" | "}
                            Velocidad inicial: <strong>{trayectoria.velocidadInicial.toFixed(2)} m/s</strong>
                        </p>
                    </div>
                </div>

                {/* INFO ADICIONAL */}
                <div style={{
                    marginTop: "20px",
                    padding: "15px",
                    background: "#e8f4f8",
                    borderRadius: "10px",
                    borderLeft: "4px solid #3498db"
                }}>
                    <p style={{
                        margin: "0",
                        fontSize: "13px",
                        color: "#34495e",
                        lineHeight: "1.6"
                    }}>
                        <strong>ℹ️ Nota:</strong> La trayectoria se calcula usando física clásica de tiro parabólico.
                        Se asume compresión del resorte = tensión × 1cm/s.
                    </p>
                </div>
            </div>

            {/* PANEL DERECHO: TABLA DE PARÁMETROS */}
            <div style={{
                width: "400px",
                background: "white",
                borderRadius: "15px",
                padding: "40px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                overflowY: "auto"
            }}>
                <h2 style={{
                    color: "#2c3e50",
                    marginBottom: '30px',
                    textAlign: 'center'
                }}>
                    Parámetros Físicos
                </h2>

                <table style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: "0 12px"
                }}>
                    <thead>
                    <tr style={{ borderBottom: "2px solid #ecf0f1" }}>
                        <th style={{
                            textAlign: "left",
                            padding: "12px",
                            color: "#7f8c8d",
                            fontWeight: "600",
                            fontSize: "13px"
                        }}>
                            PARÁMETRO
                        </th>
                        <th style={{
                            textAlign: "right",
                            padding: "12px",
                            color: "#7f8c8d",
                            fontWeight: "600",
                            fontSize: "13px"
                        }}>
                            VALOR
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr style={{ background: "#f8f9fa", borderRadius: "8px" }}>
                        <td style={{ padding: "12px", fontWeight: "500", color: "#2c3e50", fontSize: "14px" }}>
                            Constante del Resorte (N/m)
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                            <input
                                type="number"
                                step="0.1"
                                value={parametros.constanteResorte}
                                onChange={(e) => actualizarParametro('constanteResorte', e.target.value)}
                                style={{
                                    width: "90px",
                                    padding: "6px",
                                    border: "2px solid #e0e0e0",
                                    borderRadius: "6px",
                                    textAlign: "right",
                                    fontSize: "14px",
                                    fontWeight: "600"
                                }}
                            />
                        </td>
                    </tr>

                    <tr style={{ background: "#f8f9fa", borderRadius: "8px" }}>
                        <td style={{ padding: "12px", fontWeight: "500", color: "#2c3e50", fontSize: "14px" }}>
                            Distancia al FSR (cm)
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                            <input
                                type="number"
                                step="1"
                                value={parametros.distanciaFSR}
                                onChange={(e) => actualizarParametro('distanciaFSR', e.target.value)}
                                style={{
                                    width: "90px",
                                    padding: "6px",
                                    border: "2px solid #e0e0e0",
                                    borderRadius: "6px",
                                    textAlign: "right",
                                    fontSize: "14px",
                                    fontWeight: "600"
                                }}
                            />
                        </td>
                    </tr>

                    <tr style={{ background: "#f8f9fa", borderRadius: "8px" }}>
                        <td style={{ padding: "12px", fontWeight: "500", color: "#2c3e50", fontSize: "14px" }}>
                            Masa del Proyectil (g)
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                            <input
                                type="number"
                                step="1"
                                value={parametros.masaProyectil}
                                onChange={(e) => actualizarParametro('masaProyectil', e.target.value)}
                                style={{
                                    width: "90px",
                                    padding: "6px",
                                    border: "2px solid #e0e0e0",
                                    borderRadius: "6px",
                                    textAlign: "right",
                                    fontSize: "14px",
                                    fontWeight: "600"
                                }}
                            />
                        </td>
                    </tr>

                    <tr style={{ background: "#f8f9fa", borderRadius: "8px" }}>
                        <td style={{ padding: "12px", fontWeight: "500", color: "#2c3e50", fontSize: "14px" }}>
                            Gravedad (m/s²)
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                            <input
                                type="number"
                                step="0.01"
                                value={parametros.gravedad}
                                onChange={(e) => actualizarParametro('gravedad', e.target.value)}
                                style={{
                                    width: "90px",
                                    padding: "6px",
                                    border: "2px solid #e0e0e0",
                                    borderRadius: "6px",
                                    textAlign: "right",
                                    fontSize: "14px",
                                    fontWeight: "600"
                                }}
                            />
                        </td>
                    </tr>

                    <tr style={{ background: "#f8f9fa", borderRadius: "8px" }}>
                        <td style={{ padding: "12px", fontWeight: "500", color: "#2c3e50", fontSize: "14px" }}>
                            Altura Inicial (m)
                        </td>
                        <td style={{ padding: "12px", textAlign: "right" }}>
                            <input
                                type="number"
                                step="0.1"
                                value={parametros.alturaInicial}
                                onChange={(e) => actualizarParametro('alturaInicial', e.target.value)}
                                style={{
                                    width: "90px",
                                    padding: "6px",
                                    border: "2px solid #e0e0e0",
                                    borderRadius: "6px",
                                    textAlign: "right",
                                    fontSize: "14px",
                                    fontWeight: "600"
                                }}
                            />
                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default App;