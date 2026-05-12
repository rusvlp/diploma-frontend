// HomePage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { courseApi, type CourseResponse } from "@/shared/api/course";
import { userApi, type UserResponse } from "@/shared/api/user";
import "./HomePage.css";

const formatDescription = (text: string | undefined): string => {
    if (!text) return '';
    return text.replace(/\\n/g, '\n');
};

const HomePage = () => {
    const navigate = useNavigate();
    const { user } = useOutletContext<{ user: UserResponse }>();
    const [courses, setCourses] = useState<CourseResponse[]>([]);
    const [users, setUsers] = useState<UserResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [savingRole, setSavingRole] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (user.role === "student") {
                    const coursesRes = await courseApi.getAll();
                    setCourses(coursesRes.data.courses || []);
                } else if (user.role === "teacher") {
                    const coursesRes = await courseApi.getMy();
                    setCourses(coursesRes.data.courses || []);
                } else if (user.role === "admin") {
                    const usersRes = await userApi.getAll();
                    setUsers(usersRes.data.users || []);
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const handleCreateCourse = () => {
        navigate("/courses/create");
    };

    const handleOpenGroups = () => {
        navigate("/groups");
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        setSavingRole(true);
        try {
            await userApi.patchRole(userId, newRole);

            // Обновляем список пользователей
            const usersRes = await userApi.getAll();
            setUsers(usersRes.data.users || []);

            setEditingUserId(null);
        } catch (error) {
            console.error("Failed to change role:", error);
        } finally {
            setSavingRole(false);
        }
    };

    const getRoleLabel = (role: string): string => {
        const labels: Record<string, string> = {
            student: "Студент",
            teacher: "Преподаватель",
            admin: "Администратор",
        };
        return labels[role] || role;
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Загрузка...</p>
            </div>
        );
    }

    // Отображение для админа
    if (user.role === "admin") {
        return (
            <div className="home-container">
                <main className="home-main">
                    <div className="users-section">
                        <div className="section-header">
                            <h2 className="section-title">Пользователи</h2>
                        </div>

                        {users.length === 0 ? (
                            <div className="empty-state">
                                <p className="empty-message">Пользователи не найдены</p>
                            </div>
                        ) : (
                            <div className="users-table-wrapper">
                                <table className="users-table">
                                    <thead>
                                    <tr>
                                        <th>Имя</th>
                                        <th>Email</th>
                                        <th>Роль</th>
                                        <th>Действия</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {users.map((u) => (
                                        <tr key={u.id}>
                                            <td>
                                                <div className="user-cell">
                                                    <div className="user-avatar-small">
                                                        {u.full_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="user-name-cell">{u.full_name}</span>
                                                </div>
                                            </td>
                                            <td>{u.email}</td>
                                            <td>
                                                <span className={`role-badge role-${u.role}`}>
                                                    {getRoleLabel(u.role)}
                                                </span>
                                            </td>
                                            <td>
                                                {u.role !== "admin" && (
                                                    <div className="role-actions">
                                                        {editingUserId === u.id ? (
                                                            <div className="role-select-group">
                                                                <select
                                                                    className="role-select"
                                                                    defaultValue={u.role}
                                                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                                    disabled={savingRole}
                                                                >
                                                                    <option value="student">Студент</option>
                                                                    <option value="teacher">Преподаватель</option>
                                                                </select>
                                                                <button
                                                                    className="cancel-role-button"
                                                                    onClick={() => setEditingUserId(null)}
                                                                    disabled={savingRole}
                                                                    title="Отмена"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                className="change-role-button"
                                                                onClick={() => setEditingUserId(u.id)}
                                                            >
                                                                Изменить роль
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                {u.role === "admin" && (
                                                    <span className="admin-text">Администратор</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        );
    }

    // Отображение для студента и преподавателя
    return (
        <div className="home-container">
            <main className="home-main">
                <div className="courses-section">
                    <div className="section-header">
                        <h2 className="section-title">
                            {user.role === "student" ? "Доступные курсы" : "Мои курсы"}
                        </h2>
                        {user.role === "teacher" && (
                            <div className="section-header-actions">
                                <button onClick={handleOpenGroups} className="open-groups-button">
                                    Открыть группы
                                </button>
                                <button onClick={handleCreateCourse} className="create-course-button">
                                    Создать курс
                                </button>
                            </div>
                        )}
                    </div>

                    {courses.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-message">В данный момент курсы не найдены</p>
                        </div>
                    ) : (
                        <div className="courses-grid">
                            {courses.map((course) => (
                                <div key={course.id} className="course-card">
                                    <h3 className="course-title">{course.title}</h3>

                                    <div className="course-description">
                                        {formatDescription(course.description).split('\n').map((line, idx, arr) => (
                                            <span key={idx}>
                                                {line}
                                                {idx < arr.length - 1 && <br />}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="course-stats">
                                        <div className="stat-item">
                                            <span className="stat-icon">📚</span>
                                            <span className="stat-value">
                                                {course.amount_of_modules || 0} модулей
                                            </span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-icon">📝</span>
                                            <span className="stat-value">
                                                {course.amount_of_lessons || 0} уроков
                                            </span>
                                        </div>
                                    </div>

                                    <div className="course-meta">
                                        <span className={`access-badge ${course.access_type === 'public' ? 'public' : 'private'}`}>
                                            {course.access_type === 'public' ? 'Публичный' : 'Приватный'}
                                        </span>
                                        {course.published_at && (
                                            <span className="publish-date">
                                                📅 {new Date(course.published_at).toLocaleDateString('ru-RU')}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        className="course-button"
                                        onClick={() => navigate(`/courses/${course.id}`)}
                                    >
                                        Подробнее
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default HomePage;