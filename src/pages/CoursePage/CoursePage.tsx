// CoursePage.tsx
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useOutletContext } from "react-router-dom";
import { userApi, type UserResponse } from "@/shared/api/user";
import { courseApi, type CourseResponse } from "@/shared/api/course";
import { moduleApi, type ModuleResponse } from "@/shared/api/module";
import { taskApi } from "@/shared/api/task";
import { groupApi, type GroupResponse } from "@/shared/api/group";
import { groupCourseApi } from "@/shared/api/groupCourse";
import "./CoursePage.css";
import {completedModuleApi} from "@/shared/api/completedModule.ts";
import {completedTheoryCourseApi} from "@/shared/api/completedTheoryCourse.ts";
import {completedCourseApi} from "@/shared/api/completedCourse.ts";

const formatDescription = (text: string | undefined): string => {
    if (!text) return '';
    return text.replace(/\\n/g, '\n');
};

type CourseUpdateData = {
    title?: string;
    description?: string;
    access_type?: "public" | "group_only";
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
                <p className="modal-text">Вы точно уверены, что хотите удалить курс?</p>
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

const CoursePage = () => {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const { user } = useOutletContext<{ user: UserResponse }>();
    const [course, setCourse] = useState<CourseResponse | null>(null);
    const [owner, setOwner] = useState<UserResponse | null>(null);
    const [modules, setModules] = useState<ModuleResponse[]>([]);
    const [hasTest, setHasTest] = useState(false);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [publishErrors, setPublishErrors] = useState<string[]>([]);

    // Состояния для прогресса студента
    const [completedModuleIds, setCompletedModuleIds] = useState<Set<string>>(new Set());
    const [allModulesCompleted, setAllModulesCompleted] = useState(false);
    const [isTheoryCompleted, setIsTheoryCompleted] = useState(false);
    const [isCourseFullyCompleted, setIsCourseFullyCompleted] = useState(false);

    // Состояния для редактирования
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState("");
    const [editedDescription, setEditedDescription] = useState("");
    const [editedAccessType, setEditedAccessType] = useState<"public" | "group_only">("public");
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Состояния для групп
    const [allGroups, setAllGroups] = useState<GroupResponse[]>([]);
    const [attachedGroups, setAttachedGroups] = useState<GroupResponse[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [attachingGroup, setAttachingGroup] = useState<string | null>(null);
    const [detachingGroup, setDetachingGroup] = useState<string | null>(null);
    const originalAttachedGroupsRef = useRef<GroupResponse[]>([]);

    // Состояние для модального окна удаления
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleStartPractice = () => {
        navigate(`/courses/${courseId}/practice`);
    };

    const fetchCourseData = async () => {
        if (!courseId) return;

        setLoading(true);
        setError(null);

        try {
            const courseRes = await courseApi.getById(courseId);
            setCourse(courseRes.data);
            setEditedTitle(courseRes.data.title);
            setEditedDescription(courseRes.data.description);
            setEditedAccessType(courseRes.data.access_type);

            if (courseRes.data.owner_id) {
                const ownerRes = await userApi.getById(courseRes.data.owner_id);
                setOwner(ownerRes.data);
            }

            const modulesRes = await moduleApi.getAllByCourseId(courseId);
            const sortedModules = (modulesRes.data.modules || []).sort(
                (a, b) => a.position - b.position
            );
            setModules(sortedModules);

            // Проверяем наличие тестов
            try {
                const tasksRes = await taskApi.getAllByCourseId(courseId);
                setHasTest(tasksRes.data.tasks && tasksRes.data.tasks.length > 0);
            } catch (err) {
                console.error(err);
                setHasTest(false);
            }

            // Загружаем прогресс для студента
            if (user?.role === "student") {
                try {
                    const completedRes = await completedModuleApi.getMy();
                    const completedModules = completedRes.data.completed_modules || [];
                    const completedIds = new Set(completedModules.map(cm => cm.module_id));
                    setCompletedModuleIds(completedIds);

                    // Проверяем, все ли модули пройдены
                    const allCompleted = sortedModules.length > 0 &&
                        sortedModules.every(m => completedIds.has(m.id));
                    setAllModulesCompleted(allCompleted);

                    // Проверяем, завершена ли теоретическая часть
                    try {
                        const theoryRes = await completedTheoryCourseApi.getMy();
                        const completedTheory = theoryRes.data.completed_theory_courses || [];
                        setIsTheoryCompleted(completedTheory.some(ctc => ctc.course_id === courseId));
                    } catch {
                        setIsTheoryCompleted(false);
                    }

                    // Проверяем, завершен ли курс полностью
                    try {
                        const courseRes = await completedCourseApi.getMy();
                        const completedCourses = courseRes.data.completed_courses || [];
                        setIsCourseFullyCompleted(completedCourses.some(cc => cc.course_id === courseId));
                    } catch {
                        setIsCourseFullyCompleted(false);
                    }
                } catch {
                    setCompletedModuleIds(new Set());
                    setAllModulesCompleted(false);
                    setIsTheoryCompleted(false);
                    setIsCourseFullyCompleted(false);
                }
            }
        } catch (err) {
            console.error("Failed to fetch course data:", err);
            setError("Не удалось загрузить данные курса");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourseData();
    }, [courseId]);

    // Проверка доступности модуля для студента
    const isModuleAccessible = (moduleIndex: number): boolean => {
        if (user?.role !== "student") return true;
        if (moduleIndex === 0) return true;

        const previousModule = modules[moduleIndex - 1];
        if (!previousModule) return false;

        return completedModuleIds.has(previousModule.id);
    };

    useEffect(() => {
        if (isEditing && editedAccessType === "group_only") {
            loadGroups();
        }
    }, [isEditing, editedAccessType]);

    const loadGroups = async () => {
        if (!courseId) return;

        setLoadingGroups(true);
        try {
            const groupsRes = await groupApi.getMy();
            const userGroups = groupsRes.data.groups || [];
            setAllGroups(userGroups);

            try {
                const groupCoursesRes = await groupCourseApi.getByCourseId(courseId);
                if (groupCoursesRes.data?.group_courses) {
                    const attachedGroupIds = groupCoursesRes.data.group_courses.map(gc => gc.group_id);
                    const attached = userGroups.filter(g => attachedGroupIds.includes(g.id));
                    setAttachedGroups(attached);
                    originalAttachedGroupsRef.current = [...attached];
                } else {
                    setAttachedGroups([]);
                    originalAttachedGroupsRef.current = [];
                }
            } catch (err) {
                console.error("Failed to fetch attached groups:", err);
                setAttachedGroups([]);
                originalAttachedGroupsRef.current = [];
            }
        } catch (err) {
            console.error("Failed to fetch groups:", err);
            setAllGroups([]);
            setAttachedGroups([]);
            originalAttachedGroupsRef.current = [];
        } finally {
            setLoadingGroups(false);
        }
    };

    useEffect(() => {
        if (course && isEditing) {
            const titleChanged = editedTitle.trim() !== course.title;
            const descriptionChanged = editedDescription.trim() !== course.description;
            const accessTypeChanged = editedAccessType !== course.access_type;

            let groupsChanged = false;
            if (editedAccessType === "group_only") {
                const originalIds = originalAttachedGroupsRef.current.map(g => g.id).sort();
                const currentIds = attachedGroups.map(g => g.id).sort();
                groupsChanged = originalIds.length !== currentIds.length ||
                    originalIds.some((id, index) => id !== currentIds[index]);
            }

            setHasChanges(titleChanged || descriptionChanged || accessTypeChanged || groupsChanged);
        }
    }, [editedTitle, editedDescription, editedAccessType, attachedGroups, course, isEditing]);

    const handleAttachGroup = async (groupId: string) => {
        if (!courseId) return;
        setAttachingGroup(groupId);
        try {
            await groupCourseApi.post(groupId, courseId);
            const group = allGroups.find(g => g.id === groupId);
            if (group) setAttachedGroups(prev => [...prev, group]);
        } catch (err) {
            console.error("Failed to attach group:", err);
            setError("Не удалось прикрепить группу");
        } finally {
            setAttachingGroup(null);
        }
    };

    const handleDetachGroup = async (groupId: string) => {
        if (!courseId) return;
        setDetachingGroup(groupId);
        try {
            const groupCoursesRes = await groupCourseApi.getByCourseId(courseId);
            const groupCourse = groupCoursesRes.data.group_courses.find(gc => gc.group_id === groupId);
            if (groupCourse) {
                await groupCourseApi.delete(groupCourse.id);
                setAttachedGroups(prev => prev.filter(g => g.id !== groupId));
            }
        } catch (err) {
            console.error("Failed to detach group:", err);
            setError("Не удалось открепить группу");
        } finally {
            setDetachingGroup(null);
        }
    };

    const availableGroups = allGroups.filter(
        group => !attachedGroups.find(attached => attached.id === group.id)
    );

    const handleEdit = () => {
        setIsEditing(true);
        if (course?.access_type === "group_only") loadGroups();
    };

    const handleCancel = () => {
        if (course) {
            setEditedTitle(course.title);
            setEditedDescription(course.description);
            setEditedAccessType(course.access_type);
            setAttachedGroups([...originalAttachedGroupsRef.current]);
        }
        setIsEditing(false);
        setHasChanges(false);
    };

    const handleSave = async () => {
        if (!courseId || !course) return;
        setIsSaving(true);
        try {
            const updateData: CourseUpdateData = {};
            const trimmedTitle = editedTitle.trim();
            const trimmedDescription = editedDescription.trim();
            if (trimmedTitle !== course.title) updateData.title = trimmedTitle;
            if (trimmedDescription !== course.description) updateData.description = trimmedDescription;
            if (editedAccessType !== course.access_type) updateData.access_type = editedAccessType;
            if (Object.keys(updateData).length > 0) await courseApi.patch(courseId, updateData);
            await fetchCourseData();
            setIsEditing(false);
            setHasChanges(false);
        } catch (err) {
            console.error("Failed to update course:", err);
            setError("Не удалось сохранить изменения");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!courseId) return;

        // Проверки перед публикацией
        const errors: string[] = [];

        // Проверка наличия модулей
        if (modules.length === 0) {
            errors.push("В курсе нет модулей. Добавьте хотя бы один модуль.");
        }

        // Проверка наличия уроков в каждом модуле
        for (const module of modules) {
            if (!module.amount_of_lessons || module.amount_of_lessons === 0) {
                errors.push(`В модуле "${module.title}" нет уроков. Добавьте хотя бы один урок.`);
            }
        }

        // Проверка наличия тестов в курсе
        if (!hasTest) {
            errors.push("В курсе нет теста. Создайте тест для курса.");
        }

        // Проверка наличия тестов в модулях
        for (const module of modules) {
            try {
                const tasksRes = await taskApi.getAllByModuleId(module.id);
                const moduleHasTest = tasksRes.data.tasks && tasksRes.data.tasks.length > 0;
                if (!moduleHasTest) {
                    errors.push(`В модуле "${module.title}" нет теста. Создайте тест для модуля.`);
                }
            } catch {
                errors.push(`Не удалось проверить наличие теста в модуле "${module.title}".`);
            }
        }

        // Если есть ошибки, показываем их
        if (errors.length > 0) {
            setPublishErrors(errors);
            return;
        }

        // Очищаем ошибки и публикуем
        setPublishErrors([]);
        setPublishing(true);
        try {
            await courseApi.patchPublish(courseId);
            await fetchCourseData();
        } catch (err) {
            console.error("Failed to publish course:", err);
            setError("Не удалось опубликовать курс");
        } finally {
            setPublishing(false);
        }
    };

    const handleDelete = async () => {
        if (!courseId) return;
        setIsDeleting(true);
        try {
            await courseApi.delete(courseId);
            navigate("/");
        } catch (err) {
            console.error("Failed to delete course:", err);
            setError("Не удалось удалить курс");
            setIsDeleteModalOpen(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCreateModule = () => navigate(`/courses/${courseId}/modules/create`);
    const handleCreateTest = () => navigate(`/courses/${courseId}/tests/create`);
    const handleViewTest = () => navigate(`/courses/${courseId}/test`);
    const handleStatistics = () => navigate(`/courses/${courseId}/statistics`);
    const handleBack = () => navigate("/");

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Загрузка...</p>
            </div>
        );
    }

    if (error || !course) {
        return (
            <div className="error-container">
                <p className="error-message">{error || "Курс не найден"}</p>
                <button onClick={handleBack} className="back-button">Вернуться на главную</button>
            </div>
        );
    }

    const isTeacher = user?.role === "teacher";
    const isStudent = user?.role === "student";
    const isPublished = !!course.published_at;

    return (
        <div className="course-page-content">
            <div className="course-header">
                <div className="course-header-top">
                    <button onClick={handleBack} className="back-button">← Назад</button>
                </div>

                <div className="course-header-main">
                    {isEditing ? (
                        <input type="text" value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} className="course-title-input" placeholder="Название курса" />
                    ) : (
                        <div className="course-title-row">
                            <h1 className="course-page-title">{course.title}</h1>
                            {isStudent && isCourseFullyCompleted && (
                                <span className="course-completed-badge" title="Курс пройден">✅</span>
                            )}
                        </div>
                    )}
                </div>

                <div className="course-info">
                    {isEditing ? (
                        <textarea value={editedDescription} onChange={(e) => setEditedDescription(e.target.value)} className="course-description-input" placeholder="Описание курса" rows={6} />
                    ) : (
                        <div className="course-description-full">
                            {formatDescription(course.description).split('\n').map((line, idx, arr) => (
                                <span key={idx}>{line}{idx < arr.length - 1 && <br />}</span>
                            ))}
                        </div>
                    )}

                    <div className="course-meta-info">
                        <div className="meta-item">
                            <span className="meta-label">Тип доступа:</span>
                            {isEditing ? (
                                <select value={editedAccessType} onChange={(e) => setEditedAccessType(e.target.value as "public" | "group_only")} className="access-type-select">
                                    <option value="public">Для всех</option>
                                    <option value="group_only">Для определенных групп</option>
                                </select>
                            ) : (
                                <span className={`access-badge ${course.access_type === 'public' ? 'public' : 'private'}`}>
                                {course.access_type === 'public' ? 'Публичный' : 'Приватный'}
                            </span>
                            )}
                        </div>
                        {owner && (
                            <div className="meta-item">
                                <span className="meta-label">Создатель:</span>
                                <span className="meta-value">{owner.full_name}</span>
                            </div>
                        )}
                        {isPublished && (
                            <div className="meta-item">
                                <span className="meta-label">Опубликован:</span>
                                <span className="meta-value">{new Date(course.published_at).toLocaleDateString('ru-RU')}</span>
                            </div>
                        )}
                        {isStudent && (
                            <div className="meta-item">
                                <span className="meta-label">Пройдено модулей:</span>
                                <span className="meta-value">{completedModuleIds.size} из {modules.length}</span>
                            </div>
                        )}
                        {isStudent && isCourseFullyCompleted && (
                            <div className="meta-item">
                                <span className="meta-label">Статус:</span>
                                <span className="meta-value status-completed">Завершен</span>
                            </div>
                        )}
                    </div>

                    {/* Секция групп при редактировании */}
                    {isEditing && editedAccessType === "group_only" && (
                        <div className="groups-section">
                            <div className="groups-header">
                                <h3 className="groups-title">Группы</h3>
                            </div>
                            {loadingGroups ? (
                                <div className="groups-loading">Загрузка групп...</div>
                            ) : allGroups.length === 0 ? (
                                <div className="groups-empty">
                                    <p>В настоящий момент нет созданных групп</p>
                                    <p className="groups-empty-hint">Создайте группу, чтобы прикрепить её к курсу</p>
                                </div>
                            ) : (
                                <>
                                    {attachedGroups.length > 0 && (
                                        <div className="attached-groups">
                                            <h4 className="groups-subtitle">Прикрепленные группы</h4>
                                            <div className="groups-list">
                                                {attachedGroups.map((group) => (
                                                    <div key={group.id} className="group-item attached">
                                                        <div className="group-info">
                                                            <span className="group-icon">👥</span>
                                                            <div className="group-details">
                                                                <span className="group-name">{group.title}</span>
                                                                {group.description && <span className="group-description">{group.description.length > 60 ? group.description.substring(0, 60) + '...' : group.description}</span>}
                                                            </div>
                                                        </div>
                                                        <button type="button" onClick={() => handleDetachGroup(group.id)} className="detach-group-button" disabled={detachingGroup === group.id} title="Открепить группу">{detachingGroup === group.id ? "..." : "✕"}</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {availableGroups.length > 0 && (
                                        <div className="available-groups">
                                            <h4 className="groups-subtitle">Доступные группы</h4>
                                            <div className="groups-list">
                                                {availableGroups.map((group) => (
                                                    <div key={group.id} className="group-item">
                                                        <div className="group-info">
                                                            <span className="group-icon">👥</span>
                                                            <div className="group-details">
                                                                <span className="group-name">{group.title}</span>
                                                                {group.description && <span className="group-description">{group.description.length > 60 ? group.description.substring(0, 60) + '...' : group.description}</span>}
                                                            </div>
                                                        </div>
                                                        <button type="button" onClick={() => handleAttachGroup(group.id)} className="attach-group-button" disabled={attachingGroup === group.id} title="Прикрепить группу">{attachingGroup === group.id ? "..." : "+"}</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Кнопки теста и статистики для учителя */}
                    {isTeacher && !isEditing && (
                        <div className="course-additional-actions">
                            {hasTest ? (
                                <button onClick={handleViewTest} className="view-test-button">Просмотреть тест</button>
                            ) : (
                                <button onClick={handleCreateTest} className="create-test-button">Создать тест</button>
                            )}
                            <button onClick={handleStatistics} className="statistics-button">Статистика</button>
                        </div>
                    )}

                    {/* Информация и кнопки для студента */}
                    {isStudent && (
                        <div className="course-additional-actions">
                            {/* Курс завершен */}
                            {isCourseFullyCompleted && (
                                <div className="course-completed-info">
                                    <span className="completed-icon">🎉</span>
                                    <span className="completed-text">Курс успешно завершен!</span>
                                </div>
                            )}

                            {/* Теоретическая часть завершена, но курс еще не завершен */}
                            {isTheoryCompleted && !isCourseFullyCompleted && (
                                <>
                                    <div className="course-theory-completed-info">
                                        <span className="completed-icon">📚</span>
                                        <span className="completed-text">Теоретическая часть курса пройдена</span>
                                    </div>
                                    <button onClick={handleStartPractice} className="start-practice-button">
                                        Начать практическую часть
                                    </button>
                                </>
                            )}

                            {/* Теоретическая часть не завершена, но все модули пройдены - можно пройти тест */}
                            {!isTheoryCompleted && !isCourseFullyCompleted && allModulesCompleted && hasTest && (
                                <button onClick={handleViewTest} className="view-test-button">Пройти тест</button>
                            )}

                            {/* Теоретическая часть не завершена, не все модули пройдены - тест заблокирован */}
                            {!isTheoryCompleted && !isCourseFullyCompleted && hasTest && !allModulesCompleted && (
                                <div className="test-locked-info">
                                    <span className="locked-icon">🔒</span>
                                    <span className="locked-text">Тест доступен после завершения всех модулей</span>
                                </div>
                            )}
                        </div>
                    )}

                    {isTeacher && (
                        <div className="course-actions-wrapper">
                            <div className="course-actions">
                                {!isPublished && !isEditing && (
                                    <button onClick={handlePublish} disabled={publishing} className="publish-button">
                                        {publishing ? "Публикация..." : "Опубликовать"}
                                    </button>
                                )}
                                {!isEditing ? (
                                    <>
                                        <button onClick={handleEdit} className="edit-button">Редактировать курс</button>
                                        <button onClick={() => setIsDeleteModalOpen(true)} className="delete-button">Удалить курс</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={handleSave} disabled={isSaving || !hasChanges} className="save-button">
                                            {isSaving ? "Сохранение..." : "Сохранить"}
                                        </button>
                                        <button onClick={handleCancel} className="cancel-edit-button">Отмена</button>
                                    </>
                                )}
                            </div>

                            {/* Ошибки публикации под кнопками */}
                            {publishErrors.length > 0 && !isEditing && (
                                <div className="publish-errors">
                                    <p className="publish-errors-title">Невозможно опубликовать курс:</p>
                                    <ul className="publish-errors-list">
                                        {publishErrors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="modules-section">
                <div className="section-header">
                    <h2 className="section-title">Модули курса</h2>
                    {isTeacher && (
                        <button onClick={handleCreateModule} className="create-module-button">Создать модуль</button>
                    )}
                </div>

                {modules.length === 0 ? (
                    <div className="empty-state">
                        <p className="empty-message">В данный момент модули не найдены</p>
                    </div>
                ) : (
                    <div className="modules-grid">
                        {modules.map((module, index) => {
                            const isCompleted = completedModuleIds.has(module.id);
                            const accessible = isModuleAccessible(index);

                            return (
                                <div key={module.id} className={`module-card ${!accessible ? 'locked' : ''} ${isCompleted ? 'completed' : ''}`}>
                                    <div className="module-position">
                                        Модуль #{module.position}
                                        {isCompleted && <span className="completed-check">✅</span>}
                                        {!accessible && isStudent && <span className="locked-badge">🔒</span>}
                                    </div>
                                    <h3 className="module-title">{module.title}</h3>
                                    <div className="module-description">
                                        {formatDescription(module.description).split('\n').map((line, idx, arr) => (
                                            <span key={idx}>{line}{idx < arr.length - 1 && <br />}</span>
                                        ))}
                                    </div>
                                    <div className="module-stats">
                                        <div className="stat-item">
                                            <span className="stat-icon">📝</span>
                                            <span className="stat-value">{module.amount_of_lessons || 0} уроков</span>
                                        </div>
                                    </div>
                                    {accessible ? (
                                        <button className="module-button" onClick={() => navigate(`/modules/${module.id}`)}>
                                            {isCompleted ? "Просмотреть" : "Подробнее"}
                                        </button>
                                    ) : (
                                        <div className="module-locked-text">Завершите предыдущий модуль</div>
                                    )}
                                </div>
                            );
                        })}
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

export default CoursePage;