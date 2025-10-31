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
            console.log("Respuesta completa del backend:", resp);
            alert(resp);
            setConfirmado(true);
        } catch (e) {
            console.error("Error al enviar al backend:", e);
            alert("Error enviando datos");
        }
    };


    return (
        <div style={{ textAlign: "center", padding: "40px" }}>
            <h1>Control del Lanzador</h1>

            <div style={{ margin: "20px" }}>
                <label>Ángulo: {angulo}°</label>
                <input
                    type="range"
                    min="0"
                    max="90"
                    value={angulo}
                    onChange={(e) => setAngulo(e.target.value)}
                    style={{ width: "300px", marginLeft: "10px" }}
                />
            </div>

            <div style={{ margin: "20px" }}>
                <button
                    onMouseDown={iniciarTension}
                    onMouseUp={soltarTension}
                    onMouseLeave={soltarTension}
                    disabled={tensionando}
                    style={{
                        padding: "15px 30px",
                        fontSize: "18px",
                        cursor: "pointer",
                        background: tensionando ? "#aaa" : "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "10px",
                    }}
                >
                    {tensionando ? `Tensionando... ${contador}s` : "Oprime para tensionar"}
                </button>
            </div>

            {!tensionando && tension > 0 && !confirmado && (
                <div style={{ marginTop: "20px" }}>
                    <p>Tensión registrada: {tension} segundos</p>
                    <button
                        onClick={confirmarEnvio}
                        style={{
                            padding: "10px 25px",
                            fontSize: "16px",
                            background: "green",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                        }}
                    >
                        Enviar
                    </button>
                </div>
            )}

            {confirmado && <p style={{ color: "green" }}>Comando enviado correctamente</p>}
        </div>
    );
}

export default App;
