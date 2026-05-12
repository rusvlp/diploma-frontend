import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "@/shared/api/auth";
import { Input } from "@/components/ui/Input/Input";
import { Button } from "@/components/ui/Button/Button";
import axios from "axios";
import "./LoginPage.css"

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const isValid = email.trim() !== "" && password.trim() !== "";

    const handleLogin = async () => {
        if (!isValid) return;

        try {
            const response = await authApi.login(email, password);
            localStorage.setItem("access_token", response.data.access_token);
            localStorage.setItem("refresh_token", response.data.refresh_token);

            navigate("/", { replace: true });
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 500) {
                    setError("Неверный email или пароль");
                } else {
                    setError("Ошибка сервера");
                }
            } else {
                setError("Неизвестная ошибка");
            }
        }
    };

    return (
        <div className="auth-container">
            <h1>Вход</h1>

            <Input
                placeholder="Email"
                value={email}
                onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                }}
            />

            <Input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                }}
            />

            {error && <div className="error">{error}</div>}

            <Button disabled={!isValid} onClick={handleLogin}>
                Войти
            </Button>

            <p>
                <Link to="/signup">Забыли пароль?</Link>
            </p>

            <p>
                Нет аккаунта? <Link to="/signup">Регистрация</Link>
            </p>
        </div>
    );
};

export default LoginPage;