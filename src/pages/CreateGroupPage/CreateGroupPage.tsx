// CreateGroupPage.tsx
import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { groupApi } from "@/shared/api/group";
import { type UserResponse } from "@/shared/api/user";
import "./CreateGroupPage.css";

// Тип для ошибки API
interface ApiError {
    response?: {
        status: number;
        data?: {
            detail?: string;
        };
    };
    message?: string;
}

const CreateGroupPage = () => {
    const navigate = useNavigate();
    const { user } = useOutletContext<{ user: UserResponse }>();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError("Название группы обязательно");
            return;
        }

        setLoading(true);

        try {
            await groupApi.post(
                title.trim(),
                description.trim(),
                user.id
            );

            navigate(-1);
        } catch (err) {
            console.error("Failed to create group:", err);

            const apiError = err as ApiError;

            if (apiError.response?.status === 409) {
                setError("Группа с таким названием уже существует. Выберите другое название");
            } else {
                setError("Не удалось создать группу. Попробуйте позже.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        navigate(-1);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        if (error?.includes("название")) {
            setError(null);
        }
    };

    return (
        <div className="create-group-page">
            <div className="create-group-card">
                <h1 className="create-group-title">Создание новой группы</h1>

                <form onSubmit={handleSubmit} className="create-group-form">
                    <div className="form-group">
                        <label htmlFor="title" className="form-label">
                            Название группы *
                        </label>
                        <input
                            id="title"
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder="Введите название группы"
                            className={`form-input ${error?.includes("название") ? "form-input-error" : ""}`}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description" className="form-label">
                            Описание группы
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value);
                                if (error?.includes("Описание")) {
                                    setError(null);
                                }
                            }}
                            placeholder="Введите описание группы (необязательно)"
                            className="form-textarea"
                            rows={4}
                            disabled={loading}
                        />
                    </div>

                    {error && <div className="form-error">{error}</div>}

                    <div className="form-actions">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="cancel-button"
                            disabled={loading}
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            className="submit-button"
                            disabled={loading}
                        >
                            {loading ? "Создание..." : "Создать группу"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateGroupPage;