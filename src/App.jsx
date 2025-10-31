import { useState, useRef } from "react";
import { enviarServos } from "./services/api";

function App() {
    const [angulo, setAngulo] = useState(0);
    const [tension, setTension] = useState(0);
    const [contador, setContador] = useState(0);
    const [tensionando, setTensionando] = useState(false);
    const [confirmado, setConfirmado] = useState(false);
    const intervalRef = useRef(null);

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
            const resp = await enviarServos(angulo, tension);
            console.log("Respuesta del backend:", resp);
            setConfirmado(true);
        } catch (e) {
            alert("Error enviando datos");
        }
    };

    return (
        <div
            style={{
                textAlign: "center",
                padding: "50px",
                fontFamily: "Arial, sans-serif",
                background: "#f5f6fa",
                minHeight: "100vh",
            }}
        >
            <h1 style={{ color: "#2f3640" }}>Control del Lanzador</h1>

            <div style={{ margin: "40px auto", width: "80%", maxWidth: "400px" }}>
                <label style={{ display: "block", marginBottom: "10px", fontSize: "18px" }}>
                    Ángulo: <strong>{angulo}°</strong>
                </label>
                <input
                    type="range"
                    min="0"
                    max="90"
                    value={angulo}
                    onChange={(e) => setAngulo(e.target.value)}
                    style={{ width: "100%" }}
                />
            </div>

            <div style={{ margin: "40px auto" }}>
                <button
                    onMouseDown={iniciarTension}
                    onMouseUp={soltarTension}
                    onMouseLeave={soltarTension}
                    disabled={tensionando}
                    style={{
                        padding: "15px 35px",
                        fontSize: "18px",
                        cursor: "pointer",
                        background: tensionando ? "#aaa" : "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "10px",
                        transition: "0.2s",
                    }}
                >
                    {tensionando ? `Tensionando... ${contador}s` : "Oprime para tensionar"}
                </button>
            </div>

            {!tensionando && tension > 0 && !confirmado && (
                <div style={{ marginTop: "25px" }}>
                    <p style={{ fontSize: "18px" }}>Tensión registrada: <strong>{tension} segundos</strong></p>
                    <button
                        onClick={confirmarEnvio}
                        style={{
                            padding: "12px 30px",
                            fontSize: "16px",
                            background: "green",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            marginTop: "10px",
                        }}
                    >
                        Enviar
                    </button>
                </div>
            )}

            {confirmado && (
                <p style={{ color: "green", marginTop: "20px", fontSize: "18px" }}>
                    Comando enviado correctamente
                </p>
            )}
        </div>
    );
}

export default App;
