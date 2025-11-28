import axios from "axios";

const API_URL = "http://localhost:8080/control";

/**
 * Función que envía el ángulo y la tensión al controlador REST del backend.
 * @param {number} angulo - Ángulo de inclinación del cañón (0-90).
 * @param {number} tension - Tiempo de tensión del resorte en segundos (ej: 5).
 * @returns {Promise<any>} Respuesta del backend.
 */
export const enviarServos = async (angulo, tension) => {
    try {
        const response = await axios.post(`${API_URL}/servos`, null, {
            params: { angulo, tension },
        });
        return response.data;
    } catch (error) {
        console.error("Error enviando datos al backend:", error);
        throw error;
    }
};
