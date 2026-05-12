// Layout.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { userApi, type UserResponse } from "@/shared/api/user";
import "./Layout.css";

const Layout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState<UserResponse | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const isInitialMount = useRef(true);

    const fetchUser = useCallback(async () => {
        try {
            setLoading(true);
            const userRes = await userApi.getMe();
            setUser(userRes.data);
        } catch (error) {
            console.error("Failed to fetch user:", error);
            if (isInitialMount.current) {
                navigate("/login");
            }
        } finally {
            setLoading(false);
            isInitialMount.current = false;
        }
    }, [navigate]);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const handleLogout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        navigate("/login");
    };

    const handleProfile = () => {
        navigate("/profile");
        setDropdownOpen(false);
    };

    const handleLogoClick = () => {
        navigate("/");
    };

    const handleTerrain = () => navigate("/terrain");
    const handleLocations = () => navigate("/locations");

    if (loading) {
        return (
            <div className="layout-loading">
                <div className="loading-spinner"></div>
                <p>Загрузка...</p>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="layout">
            <header className="layout-header">
                <div className="header-left">
                    <h1 className="logo" onClick={handleLogoClick}>
                        Сервис курсов
                    </h1>
                    <nav className="header-nav">
                        <button
                            className={`nav-link${location.pathname === "/terrain" ? " active" : ""}`}
                            onClick={handleTerrain}
                        >
                            Генерация ландшафта
                        </button>
                        <button
                            className={`nav-link${location.pathname === "/locations" ? " active" : ""}`}
                            onClick={handleLocations}
                        >
                            Локации
                        </button>
                    </nav>
                </div>
                <div className="header-right">
                    <div className="user-info">
                        <span className="user-name">{user.full_name}</span>
                        <div
                            className="avatar"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                        >
                            {user.full_name.charAt(0).toUpperCase()}
                        </div>
                    </div>

                    {dropdownOpen && (
                        <>
                            <div
                                className="dropdown-overlay"
                                onClick={() => setDropdownOpen(false)}
                            />
                            <div className="dropdown-menu">
                                <button
                                    className="dropdown-item"
                                    onClick={handleProfile}
                                >
                                    👤 Перейти в профиль
                                </button>
                                <button
                                    className="dropdown-item logout"
                                    onClick={handleLogout}
                                >
                                    🚪 Выйти из аккаунта
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </header>

            <main className="layout-main">
                <Outlet context={{ user, refreshUser: fetchUser }} />
            </main>
        </div>
    );
};

export default Layout;