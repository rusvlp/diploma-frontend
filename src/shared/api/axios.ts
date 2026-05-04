import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AuthResponse } from "@/shared/api/auth";

export const API_URL = "http://localhost:8081";

export const api = axios.create({
    baseURL: API_URL,
});

interface CustomRequestConfig extends InternalAxiosRequestConfig {
    _isRetry?: boolean;
}

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomRequestConfig;

        if (error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._isRetry) {

            originalRequest._isRetry = true;

            try {
                const refreshToken = localStorage.getItem("refresh_token");

                if (!refreshToken) {
                    throw new Error("Нет refresh токена");
                }

                const response = await axios.post<AuthResponse>(
                    `${API_URL}/auth/refresh`,
                    null,
                    {
                        headers: {
                            Authorization: `Bearer ${refreshToken}`,
                        },
                    },
                );

                localStorage.setItem("access_token", response.data.access_token);
                localStorage.setItem("refresh_token", response.data.refresh_token);

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
                }

                return api.request(originalRequest);
            } catch (e) {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                window.location.href = '/login';
                throw e;
            }
        }

        throw error;
    },
);

export default api;