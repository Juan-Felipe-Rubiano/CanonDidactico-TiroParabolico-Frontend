import axios from "axios";

const API_URL = "http://localhost:8080/control";

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
