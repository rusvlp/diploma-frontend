// ProfilePage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { userApi, type UserResponse } from "@/shared/api/user";
import "./ProfilePage.css";

// Модальное окно для смены пароля
const ChangePasswordModal = ({
                                 isOpen,
                                 onClose,
                                 onSubmit,
                                 isSubmitting
                             }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (password: string) => void;
    isSubmitting: boolean;
}) => {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = () => {
        setLocalError(null);

        if (!password.trim()) {
            setLocalError("Пароль обязателен");
            return;
        }

        if (password.length < 6) {
            setLocalError("Пароль должен содержать минимум 6 символов");
            return;
        }

        if (password !== confirmPassword) {
            setLocalError("Пароли не совпадают");
            return;
        }

        onSubmit(password);
    };

    const handleClose = () => {
        setPassword("");
        setConfirmPassword("");
        setLocalError(null);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">Смена пароля</h3>

                <div className="password-form">
                    <div className="form-group">
                        <label htmlFor="new-password" className="form-label">
                            Новый пароль
                        </label>
                        <input
                            id="new-password"
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setLocalError(null);
                            }}
                            placeholder="Введите новый пароль"
                            className="form-input"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirm-password" className="form-label">
                            Подтвердите пароль
                        </label>
                        <input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                setLocalError(null);
                            }}
                            placeholder="Подтвердите новый пароль"
                            className="form-input"
                            disabled={isSubmitting}
                        />
                    </div>

                    {localError && <div className="form-error">{localError}</div>}
                </div>

                <div className="modal-actions">
                    <button onClick={handleClose} className="modal-cancel-button" disabled={isSubmitting}>
                        Отмена
                    </button>
                    <button onClick={handleSubmit} className="modal-confirm-button" disabled={isSubmitting}>
                        {isSubmitting ? "Сохранение..." : "Сменить пароль"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProfilePage = () => {
    const navigate = useNavigate();
    const { user, refreshUser } = useOutletContext<{ user: UserResponse; refreshUser: () => Promise<void> }>();
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Состояния для редактирования
    const [isEditing, setIsEditing] = useState(false);
    const [editedFullName, setEditedFullName] = useState(user.full_name);
    const [editedEmail, setEditedEmail] = useState(user.email);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Состояние для модального окна смены пароля
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Обновление начальных значений при изменении user
    useEffect(() => {
        setEditedFullName(user.full_name);
        setEditedEmail(user.email);
    }, [user]);

    // Проверка изменений
    useEffect(() => {
        if (isEditing) {
            const nameChanged = editedFullName.trim() !== user.full_name;
            const emailChanged = editedEmail.trim() !== user.email;
            setHasChanges(nameChanged || emailChanged);
        }
    }, [editedFullName, editedEmail, user, isEditing]);

    const handleEdit = () => {
        setEditedFullName(user.full_name);
        setEditedEmail(user.email);
        setIsEditing(true);
        setError(null);
        setSuccessMessage(null);
    };

    const handleCancel = () => {
        setEditedFullName(user.full_name);
        setEditedEmail(user.email);
        setIsEditing(false);
        setHasChanges(false);
        setError(null);
    };

    const handleSave = async () => {
        if (!editedFullName.trim()) {
            setError("Имя не может быть пустым");
            return;
        }

        if (!editedEmail.trim()) {
            setError("Email не может быть пустым");
            return;
        }

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await userApi.patch(
                editedFullName.trim(),
                editedEmail.trim()
            );

            await refreshUser();

            setIsEditing(false);
            setHasChanges(false);
            setSuccessMessage("Профиль успешно обновлен");

            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error("Failed to update profile:", err);
            setError("Не удалось обновить профиль");
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async (password: string) => {
        setIsChangingPassword(true);
        setError(null);
        setSuccessMessage(null);

        try {
            await userApi.patchPassword(password);
            setIsPasswordModalOpen(false);
            setSuccessMessage("Пароль успешно изменен");

            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error("Failed to change password:", err);
            setError("Не удалось изменить пароль");
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleBack = () => {
        navigate("/");
    };

    const roleLabels: Record<string, string> = {
        student: "Студент",
        teacher: "Преподаватель",
        admin: "Администратор",
    };

    return (
        <div className="profile-page">
            <div className="profile-card">
                <div className="profile-card-top">
                    <button onClick={handleBack} className="back-button">
                        ← Назад
                    </button>
                </div>

                <div className="profile-header">
                    <div className="profile-avatar">
                        {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="profile-header-info">
                        <h1 className="profile-title">Профиль</h1>
                        <span className={`role-badge role-${user.role}`}>
                            {roleLabels[user.role] || user.role}
                        </span>
                    </div>
                </div>

                <div className="profile-form">
                    <div className="form-group">
                        <label className="form-label">Имя</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editedFullName}
                                onChange={(e) => setEditedFullName(e.target.value)}
                                className="form-input"
                                placeholder="Введите имя"
                                disabled={isSaving}
                            />
                        ) : (
                            <div className="form-value">{user.full_name}</div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Email</label>
                        {isEditing ? (
                            <input
                                type="email"
                                value={editedEmail}
                                onChange={(e) => setEditedEmail(e.target.value)}
                                className="form-input"
                                placeholder="Введите email"
                                disabled={isSaving}
                            />
                        ) : (
                            <div className="form-value">{user.email}</div>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Роль</label>
                        <div className="form-value">
                            <span className={`role-badge role-${user.role}`}>
                                {roleLabels[user.role] || user.role}
                            </span>
                        </div>
                    </div>

                    {error && <div className="form-error">{error}</div>}
                    {successMessage && <div className="form-success">{successMessage}</div>}

                    <div className="profile-actions">
                        {!isEditing ? (
                            <>
                                <button onClick={handleEdit} className="edit-button">
                                    Редактировать профиль
                                </button>
                                <button
                                    onClick={() => setIsPasswordModalOpen(true)}
                                    className="change-password-button"
                                >
                                    Сменить пароль
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
                                    disabled={isSaving}
                                >
                                    Отмена
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <ChangePasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                onSubmit={handleChangePassword}
                isSubmitting={isChangingPassword}
            />
        </div>
    );
};

export default ProfilePage;