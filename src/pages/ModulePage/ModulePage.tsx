// ModulePage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { type UserResponse } from "@/shared/api/user";
import { moduleApi, type ModuleResponse } from "@/shared/api/module";
import { lessonApi, type LessonResponse } from "@/shared/api/lesson";
import { taskApi } from "@/shared/api/task";
import "./ModulePage.css";

const formatDescription = (text: string | undefined): string => {
    if (!text) return '';
    return text.replace(/\\n/g, '\n');
};

// Модальное окно подтверждения удаления
const DeleteConfirmModal = ({
                                isOpen,
                                onClose,
                                onConfirm,
                                isDeleting
                            }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">Подтверждение удаления</h3>
                <p className="modal-text">Вы точно уверены, что хотите удалить модуль?</p>
                <div className="modal-actions">
                    <button onClick={onClose} className="modal-cancel-button">
                        Нет, отмена
                    </button>
                    <button onClick={onConfirm} className="modal-confirm-button" disabled={isDeleting}>
                        {isDeleting ? "Удаление..." : "Да, удалить"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ModulePage = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const { user } = useOutletContext<{ user: UserResponse }>();
    const [module, setModule] = useState<ModuleResponse | null>(null);
    const [lessons, setLessons] = useState<LessonResponse[]>([]);
    const [hasTest, setHasTest] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Состояния для редактирования
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState("");
    const [editedDescription, setEditedDescription] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Состояние для модального окна удаления
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchModuleData = async () => {
        if (!moduleId) {
            setError("ID модуля не найден");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const moduleRes = await moduleApi.getById(moduleId);
            setModule(moduleRes.data);
            setEditedTitle(moduleRes.data.title);
            setEditedDescription(moduleRes.data.description);

            // Получаем уроки модуля
            const lessonsRes = await lessonApi.getAllByModuleId(moduleId);
            const sortedLessons = (lessonsRes.data.lessons || []).sort(
                (a, b) => a.position - b.position
            );
            setLessons(sortedLessons);

            // Проверяем наличие тестов
            try {
                const tasksRes = await taskApi.getAllByModuleId(moduleId);
                setHasTest(tasksRes.data.tasks && tasksRes.data.tasks.length > 0);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (err) {
                // Игнорируем ошибку, тестов нет
                setHasTest(false);
            }
        } catch (err) {
            console.error("Failed to fetch module data:", err);
            setError("Не удалось загрузить данные модуля");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchModuleData();
    }, [moduleId]);

    // Проверка изменений при редактировании
    useEffect(() => {
        if (module && isEditing) {
            const titleChanged = editedTitle.trim() !== module.title;
            const descriptionChanged = editedDescription.trim() !== module.description;
            setHasChanges(titleChanged || descriptionChanged);
        }
    }, [editedTitle, editedDescription, module, isEditing]);

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleCancel = () => {
        if (module) {
            setEditedTitle(module.title);
            setEditedDescription(module.description);
        }
        setIsEditing(false);
        setHasChanges(false);
    };

    const handleSave = async () => {
        if (!moduleId || !module) return;

        setIsSaving(true);
        try {
            await moduleApi.patch(
                moduleId,
                editedTitle.trim(),
                editedDescription.trim(),
                module.position
            );

            await fetchModuleData();
            setIsEditing(false);
            setHasChanges(false);
        } catch (err) {
            console.error("Failed to update module:", err);
            setError("Не удалось сохранить изменения");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!moduleId) return;

        setIsDeleting(true);
        try {
            await moduleApi.delete(moduleId);
            if (module?.course_id) {
                navigate(`/courses/${module.course_id}`);
            } else {
                navigate("/");
            }
        } catch (err) {
            console.error("Failed to delete module:", err);
            setError("Не удалось удалить модуль");
            setIsDeleteModalOpen(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCreateLesson = () => {
        navigate(`/modules/${moduleId}/lessons/create`);
    };

    const handleCreateTest = () => {
        navigate(`/modules/${moduleId}/tests/create`);
    };

    const handleViewTest = () => {
        navigate(`/modules/${moduleId}/test`);
    };

    const handleBack = () => {
        if (module?.course_id) {
            navigate(`/courses/${module.course_id}`);
        } else {
            navigate("/");
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Загрузка...</p>
            </div>
        );
    }

    if (error || !module) {
        return (
            <div className="error-container">
                <p className="error-message">{error || "Модуль не найден"}</p>
                <button onClick={handleBack} className="back-button">Вернуться к курсу</button>
            </div>
        );
    }

    const isTeacher = user?.role === "teacher";

    return (
        <div className="module-page-content">
            <div className="module-header">
                <div className="module-header-top">
                    <button onClick={handleBack} className="back-button">
                        ← Назад
                    </button>
                </div>

                <div className="module-header-main">
                    {isEditing ? (
                        <input
                            type="text"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            className="module-title-input"
                            placeholder="Название модуля"
                        />
                    ) : (
                        <h1 className="module-page-title">{module.title}</h1>
                    )}
                </div>

                <div className="module-info">
                    {isEditing ? (
                        <textarea
                            value={editedDescription}
                            onChange={(e) => setEditedDescription(e.target.value)}
                            className="module-description-input"
                            placeholder="Описание модуля"
                            rows={6}
                        />
                    ) : (
                        <div className="module-description-full">
                            {formatDescription(module.description).split('\n').map((line, idx, arr) => (
                                <span key={idx}>
                                    {line}
                                    {idx < arr.length - 1 && <br />}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="module-meta-info">
                        <div className="meta-item">
                            <span className="meta-label">Позиция:</span>
                            <span className="meta-value">Модуль #{module.position}</span>
                        </div>

                        <div className="meta-item">
                            <span className="meta-label">Уроков:</span>
                            <span className="meta-value">{module.amount_of_lessons || 0}</span>
                        </div>
                    </div>

                    {isTeacher && !isEditing && (
                        <div className="module-additional-actions">
                            {hasTest ? (
                                <button onClick={handleViewTest} className="view-test-button">
                                    Просмотреть тест
                                </button>
                            ) : (
                                <button onClick={handleCreateTest} className="create-test-button">
                                    Создать тест
                                </button>
                            )}
                        </div>
                    )}

                    {isTeacher && (
                        <div className="module-actions">
                            {!isEditing ? (
                                <>
                                    <button onClick={handleEdit} className="edit-button">
                                        Редактировать модуль
                                    </button>
                                    <button
                                        onClick={() => setIsDeleteModalOpen(true)}
                                        className="delete-button"
                                    >
                                        Удалить модуль
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || !hasChanges}
                                        className="save-button"
                                    >
                                        {isSaving ? "Сохранение..." : "Сохранить"}
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        className="cancel-edit-button"
                                    >
                                        Отмена
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="lessons-section">
                <div className="section-header">
                    <h2 className="section-title">Уроки модуля</h2>
                    {isTeacher && (
                        <button onClick={handleCreateLesson} className="create-lesson-button">
                            Создать урок
                        </button>
                    )}
                </div>

                {lessons.length === 0 ? (
                    <div className="empty-state">
                        <p className="empty-message">В данный момент уроки не найдены</p>
                    </div>
                ) : (
                    <div className="lessons-grid">
                        {lessons.map((lesson) => (
                            <div key={lesson.id} className="lesson-card">
                                <div className="lesson-position">
                                    Урок #{lesson.position}
                                </div>
                                <h3 className="lesson-title">{lesson.title}</h3>

                                <div className="lesson-description">
                                    {formatDescription(lesson.description).split('\n').map((line, idx, arr) => (
                                        <span key={idx}>
                                            {line}
                                            {idx < arr.length - 1 && <br />}
                                        </span>
                                    ))}
                                </div>

                                <button
                                    className="lesson-button"
                                    onClick={() => navigate(`/lessons/${lesson.id}`)}
                                >
                                    Подробнее
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <DeleteConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />
        </div>
    );
};

export default ModulePage;