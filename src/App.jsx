import { useState, useRef, useEffect } from "react";
// Incluimos BarChart y Bar para la nueva gráfica
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, BarChart, Bar } from 'recharts';

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

    // --- ESTADO ACTUALIZADO: Gráfica Activa ---
    const [graficoActivo, setGraficoActivo] = useState('trayectoria');

    // --- HISTORIAL DE DISPAROS (Almacena alcances teóricos y reales) ---
    const [historialDisparos, setHistorialDisparos] = useState([]);

    // --- ESTADO: PARÁMETROS FÍSICOS ---
    const [parametros, setParametros] = useState({
        constanteResorte: 130.4, // N/m
        distanciaFSR: 100, // cm (Este es el ALCANCE REAL asumido si hay impacto)
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

                // --- RESOLUCIÓN DE CÓMO GUARDAR LO REAL Y LO TEÓRICO ---
                const trayectoriaActual = calcularTrayectoria();

                const nuevoDisparo = {
                    id: historialDisparos.length + 1,
                    angulo,
                    tension,
                    alcanceTeorico: trayectoriaActual.alcance,
                    alcanceReal: parametros.distanciaFSR,
                    timestamp: new Date().toLocaleTimeString()
                };

                // Asegurarse de que el historial solo guarde, por ejemplo, los últimos 10
                setHistorialDisparos(prev => [...prev, nuevoDisparo].slice(-10));

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
    }, [angulo, tension, parametros.distanciaFSR]);

    // --- FUNCIONES DE CONTROL (sin cambios) ---
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

    const actualizarParametro = (key, value) => {
        setParametros(prev => ({
            ...prev,
            [key]: parseFloat(value) || 0
        }));
    };

    // --- CÁLCULOS DE FÍSICA: TIRO PARABÓLICO ---
    const calcularTrayectoria = () => {
        const compresion = tension * 0.01; // metros
        const energiaPotencial = 0.5 * parametros.constanteResorte * Math.pow(compresion, 2); // Joules
        const masaKg = parametros.masaProyectil / 1000;
        const velocidadInicial = Math.sqrt((2 * energiaPotencial) / masaKg); // m/s
        const anguloRad = (angulo * Math.PI) / 180;
        const vx = velocidadInicial * Math.cos(anguloRad);
        const vy = velocidadInicial * Math.sin(anguloRad);
        const tiempoVuelo = (vy + Math.sqrt(vy * vy + 2 * parametros.gravedad * parametros.alturaInicial)) / parametros.gravedad;
        const alcance = vx * tiempoVuelo; // metros

        const puntos = [];
        const numPuntos = 50;
        for (let i = 0; i <= numPuntos; i++) {
            const t = (tiempoVuelo * i) / numPuntos;
            const x = vx * t;
            const y = parametros.alturaInicial + vy * t - 0.5 * parametros.gravedad * t * t;

            if (y >= 0) {
                puntos.push({
                    x: parseFloat((x * 100).toFixed(2)),
                    y: parseFloat((y * 100).toFixed(2))
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
    const daAlObjetivo = Math.abs(trayectoria.alcance - parametros.distanciaFSR) <= 3;

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
    const datosVelocidad = calcularVelocidades();

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
    const datosEnergia = calcularEnergias();

    // 3. COMPARACIÓN TEÓRICO VS REAL
    const datosComparacion = historialDisparos.map(disparo => ({
        name: `Disp. #${disparo.id}`,
        Teórico: parseFloat(disparo.alcanceTeorico.toFixed(2)),
        Real: parseFloat(disparo.alcanceReal.toFixed(2)),
        Angulo: disparo.angulo,
        Tension: disparo.tension
    }));

    // 4. TIEMPO DE VUELO VS ÁNGULO (Cálculo principal)
    const calcularTiempoVueloVsAngulo = () => {
        const puntos = [];
        // Fijo la tensión actual (compresión) para este análisis
        const compresion = tension * 0.01;
        const energiaPotencial = 0.5 * parametros.constanteResorte * Math.pow(compresion, 2);
        const masaKg = parametros.masaProyectil / 1000;
        const velocidadInicial = Math.sqrt((2 * energiaPotencial) / masaKg);

        for (let ang = 0; ang <= 90; ang += 2) {
            const anguloRad = (ang * Math.PI) / 180;
            const vy = velocidadInicial * Math.sin(anguloRad);

            // t = (vy + sqrt(vy² + 2*g*y0)) / g
            const tiempoVuelo = (vy + Math.sqrt(vy * vy + 2 * parametros.gravedad * parametros.alturaInicial)) / parametros.gravedad;

            puntos.push({
                angulo: ang,
                tiempo: parseFloat(tiempoVuelo.toFixed(3))
            });
        }
        return puntos;
    };
    const datosTiempoVuelo = calcularTiempoVueloVsAngulo();

    // 5. MAPA DE CALOR: ÁNGULO VS TENSIÓN (Placeholder)
    const calcularMapaCalor = () => { /* ... */ return []; };
    const datosMapaCalor = calcularMapaCalor();

    // --- COMPONENTES DE GRÁFICAS ---

    // Componente 1: Trayectoria (sin cambios)
    const GraficaTrayectoria = () => (
        <>
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
        </>
    );

    // Componente 2: Velocidad vs Tiempo (sin cambios)
    const GraficaVelocidad = () => (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={datosVelocidad} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="t"
                    label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -5 }}
                    domain={[0, 'dataMax']}
                />
                <YAxis
                    label={{ value: 'Velocidad (m/s)', angle: -90, position: 'insideLeft' }}
                    domain={[0, 'dataMax']}
                />
                <Tooltip
                    formatter={(value) => `${value.toFixed(2)} m/s`}
                    labelFormatter={(label) => `Tiempo: ${label.toFixed(2)} s`}
                />
                <Legend />
                <Line
                    type="monotone"
                    dataKey="vTotal"
                    stroke="#3498db"
                    strokeWidth={2}
                    name="Velocidad Total"
                    dot={false}
                />
                <Line
                    type="monotone"
                    dataKey="vx"
                    stroke="#2ecc71"
                    strokeWidth={2}
                    name="Velocidad Horizontal (Vx)"
                    dot={false}
                />
                <Line
                    type="monotone"
                    dataKey="vy"
                    stroke="#e74c3c"
                    strokeWidth={2}
                    name="Velocidad Vertical (Vy)"
                    dot={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );

    // Componente 3: Energía vs Tiempo (sin cambios)
    const GraficaEnergia = () => (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={datosEnergia} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                    dataKey="t"
                    label={{ value: 'Tiempo (s)', position: 'insideBottom', offset: -5 }}
                    domain={[0, 'dataMax']}
                />
                <YAxis
                    label={{ value: 'Energía (J)', angle: -90, position: 'insideLeft' }}
                    domain={[0, 'dataMax']}
                />
                <Tooltip
                    formatter={(value) => `${value.toFixed(2)} J`}
                    labelFormatter={(label) => `Tiempo: ${label.toFixed(2)} s`}
                />
                <Legend />
                <Line
                    type="monotone"
                    dataKey="cinetica"
                    stroke="#f39c12"
                    strokeWidth={2}
                    name="Energía Cinética"
                    dot={false}
                />
                <Line
                    type="monotone"
                    dataKey="potencial"
                    stroke="#9b59b6"
                    strokeWidth={2}
                    name="Energía Potencial"
                    dot={false}
                />
                <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#1abc9c"
                    strokeWidth={3}
                    name="Energía Total"
                    dot={false}
                />
            </LineChart>
        </ResponsiveContainer>
    );

    // Componente 4: Gráfica de Comparación Teórico vs Real (sin cambios)
    const GraficaComparacion = () => {
        if (datosComparacion.length === 0) {
            return (
                <div style={{ textAlign: 'center', padding: '50px', color: '#7f8c8d' }}>
                    <p>🎯 Realiza un disparo para ver la comparación Teórico vs Real.</p>
                </div>
            );
        }

        return (
            <ResponsiveContainer width="100%" height={300}>
                <BarChart
                    data={datosComparacion}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis
                        label={{ value: 'Alcance (cm)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                        formatter={(value, name, props) => {
                            if (name === 'Teórico') {
                                return [`${value} cm`, `Alcance Teórico (Ángulo: ${props.payload.Angulo}°, Tensión: ${props.payload.Tension}s)`];
                            }
                            return [`${value} cm`, 'Alcance Real (Impacto FSR)'];
                        }}
                    />
                    <Legend />
                    <Bar dataKey="Teórico" fill="#e67e22" name="Alcance Teórico" />
                    <Bar dataKey="Real" fill="#3498db" name="Alcance Real (FSR)" />
                </BarChart>
            </ResponsiveContainer>
        );
    };

    // Componente 5: Tiempo de Vuelo vs Ángulo (NUEVA)
    const GraficaTiempoVuelo = () => {
        const maxTiempo = datosTiempoVuelo.reduce((max, p) => (p.tiempo > max ? p.tiempo : max), 0);
        const anguloMax = datosTiempoVuelo.find(p => p.tiempo === maxTiempo)?.angulo;

        return (
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={datosTiempoVuelo} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                        dataKey="angulo"
                        label={{ value: 'Ángulo (grados)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                        label={{ value: 'Tiempo de Vuelo (s)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                        formatter={(value) => `${value.toFixed(3)} s`}
                        labelFormatter={(label) => `Ángulo: ${label}°`}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="tiempo"
                        stroke="#8e44ad" // Morado
                        strokeWidth={2}
                        name={`Tiempo de Vuelo (Tensión: ${tension}s)`}
                        dot={false}
                    />
                    {/* Referencia para el ángulo que da el máximo tiempo de vuelo (90 grados si y0=0) */}
                    {anguloMax && (
                        <ReferenceLine
                            x={anguloMax}
                            stroke="#c0392b"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            label={{ value: `${anguloMax}° (Max T)`, position: 'top', fill: '#c0392b' }}
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        );
    };

    // Componente 6: Mapa de Calor (Placeholder)
    const GraficaMapaCalor = () => (
        <div style={{ textAlign: 'center', padding: '50px', color: '#7f8c8d' }}>
            <p>Mapa de alcance Teórico (Ángulo vs Tensión) no implementado con Recharts en este ejemplo.</p>
        </div>
    );

    // Función para renderizar la gráfica activa
    const renderizarGrafica = () => {
        switch (graficoActivo) {
            case 'trayectoria':
                return <GraficaTrayectoria />;
            case 'velocidad':
                return <GraficaVelocidad />;
            case 'energia':
                return <GraficaEnergia />;
            case 'comparacion':
                return <GraficaComparacion />;
            case 'tiempoVuelo': // Nuevo caso
                return <GraficaTiempoVuelo />;
            case 'mapaCalor':
                return <GraficaMapaCalor />;
            default:
                return <GraficaTrayectoria />;
        }
    };

    // --- ESTILOS (sin cambios) ---
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
                {/* SELECTOR DE GRÁFICAS */}
                <div style={{
                    marginBottom: '30px',
                    textAlign: 'center'
                }}>
                    <label style={{
                        display: "block",
                        marginBottom: "10px",
                        fontSize: "18px",
                        color: '#2c3e50'
                    }}>
                        Seleccionar Gráfica:
                    </label>
                    <select
                        value={graficoActivo}
                        onChange={(e) => setGraficoActivo(e.target.value)}
                        style={{
                            padding: '10px 15px',
                            fontSize: '16px',
                            borderRadius: '8px',
                            border: '2px solid #3498db',
                            backgroundColor: 'white',
                            color: '#2c3e50',
                            cursor: 'pointer',
                            maxWidth: '400px',
                            width: '100%',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                    >
                        <option value="trayectoria">Trayectoria (Altura vs. Distancia)</option>
                        <option value="velocidad">Velocidad vs. Tiempo</option>
                        <option value="energia">Energía vs. Tiempo</option>
                        <option value="tiempoVuelo">Tiempo de Vuelo vs. Ángulo</option> {/* NUEVA OPCIÓN */}
                        <option value="comparacion">Comparación: Teórico vs. Real (Historial)</option>
                        <option value="mapaCalor">Mapa de Alcance (Ángulo vs. Tensión)</option>
                    </select>
                </div>

                <h2 style={{
                    color: "#2c3e50",
                    marginBottom: '30px',
                    textAlign: 'center'
                }}>
                    {graficoActivo === 'trayectoria' && 'Trayectoria Teórica'}
                    {graficoActivo === 'velocidad' && 'Análisis de Velocidad vs. Tiempo'}
                    {graficoActivo === 'energia' && 'Análisis de Energía vs. Tiempo'}
                    {graficoActivo === 'comparacion' && 'Historial de Alcance: Teórico vs. Real 📊'}
                    {graficoActivo === 'tiempoVuelo' && 'Tiempo de Vuelo vs. Ángulo de Lanzamiento ⏱️'} {/* NUEVO TÍTULO */}
                    {graficoActivo === 'mapaCalor' && 'Mapa de Alcance Teórico'}
                </h2>

                {/* CONTENEDOR DE GRÁFICA ACTIVA */}
                <div style={{
                    background: "#f8f9fa",
                    padding: "20px",
                    borderRadius: "12px",
                    marginBottom: "30px",
                    minHeight: '350px'
                }}>
                    {renderizarGrafica()}
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
                        La gráfica de **Tiempo de Vuelo vs. Ángulo** asume la **tensión actual ({tension} segundos)** como constante.
                    </p>
                </div>
            </div>

            {/* PANEL DERECHO: TABLA DE PARÁMETROS (sin cambios) */}
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