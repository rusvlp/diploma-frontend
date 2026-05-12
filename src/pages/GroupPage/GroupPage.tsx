// GroupPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { groupApi, type GroupResponse } from "@/shared/api/group";
import { groupMemberApi } from "@/shared/api/groupMember";
import { userApi, type UserResponse } from "@/shared/api/user";
import "./GroupPage.css";

interface ApiError {
    response?: {
        status: number;
        data?: {
            detail?: string;
        };
    };
    message?: string;
}

interface GroupWithMembers {
    group: GroupResponse;
    members: UserResponse[];
    isExpanded: boolean;
    loadingMembers: boolean;
}

const GroupPage = () => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState<GroupWithMembers[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Состояния для добавления участника
    const [addingMemberGroupId, setAddingMemberGroupId] = useState<string | null>(null);
    const [newMemberEmail, setNewMemberEmail] = useState("");
    const [addingMember, setAddingMember] = useState(false);
    const [memberError, setMemberError] = useState<string | null>(null);

    const fetchGroups = async () => {
        setLoading(true);
        setError(null);

        try {
            const groupsRes = await groupApi.getMy();
            const fetchedGroups = groupsRes.data.groups || [];

            setGroups(
                fetchedGroups.map(group => ({
                    group,
                    members: [],
                    isExpanded: false,
                    loadingMembers: false,
                }))
            );
        } catch (err) {
            console.error("Failed to fetch groups:", err);
            setError("Не удалось загрузить группы");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    // Переключение раскрытия группы и загрузка участников
    const handleToggleGroup = async (groupId: string) => {
        setGroups(prev =>
            prev.map(item => {
                if (item.group.id === groupId) {
                    const newExpanded = !item.isExpanded;
                    return {
                        ...item,
                        isExpanded: newExpanded,
                    };
                }
                return item;
            })
        );

        // Если раскрываем группу, загружаем участников
        const groupItem = groups.find(g => g.group.id === groupId);
        if (groupItem && !groupItem.isExpanded) {
            await loadMembers(groupId);
        }
    };

    // Загрузка участников группы
    const loadMembers = async (groupId: string) => {
        setGroups(prev =>
            prev.map(item =>
                item.group.id === groupId
                    ? { ...item, loadingMembers: true }
                    : item
            )
        );

        try {
            // Получаем связи group_member
            const membersRes = await groupMemberApi.getAllByGroupId(groupId);
            const groupMembers = membersRes.data.group_members || [];

            // Получаем информацию о пользователях
            const userPromises = groupMembers.map(member =>
                userApi.getById(member.user_id)
                    .then(res => res.data)
                    .catch(err => {
                        console.error(`Failed to fetch user ${member.user_id}:`, err);
                        return null;
                    })
            );

            const users = (await Promise.all(userPromises)).filter((u): u is UserResponse => u !== null);

            setGroups(prev =>
                prev.map(item =>
                    item.group.id === groupId
                        ? { ...item, members: users, loadingMembers: false }
                        : item
                )
            );
        } catch (err) {
            console.error("Failed to load members:", err);
            setGroups(prev =>
                prev.map(item =>
                    item.group.id === groupId
                        ? { ...item, loadingMembers: false }
                        : item
                )
            );
        }
    };

    // Добавление участника в группу
    const handleAddMember = async (groupId: string) => {
        if (!newMemberEmail.trim()) {
            setMemberError("Введите email участника");
            return;
        }

        // Простая проверка email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newMemberEmail.trim())) {
            setMemberError("Введите корректный email");
            return;
        }

        setAddingMember(true);
        setMemberError(null);

        try {
            await groupMemberApi.post(newMemberEmail.trim(), groupId);

            // Перезагружаем участников группы
            await loadMembers(groupId);

            setNewMemberEmail("");
            setAddingMemberGroupId(null);
            setSuccessMessage("Участник успешно добавлен");

            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error("Failed to add member:", err);

            const apiError = err as ApiError;

            if (apiError.response?.status === 404) {
                setMemberError("Пользователь с таким email не найден");
            } else if (apiError.response?.status === 409) {
                setMemberError("Этот пользователь уже в группе");
            } else {
                setMemberError("Не удалось добавить участника");
            }
        } finally {
            setAddingMember(false);
        }
    };

    // Удаление участника из группы
    const handleRemoveMember = async (groupId: string, memberId: string) => {
        try {
            // Находим group_member запись для удаления
            const membersRes = await groupMemberApi.getAllByGroupId(groupId);
            const groupMember = membersRes.data.group_members.find(
                gm => gm.user_id === memberId
            );

            if (groupMember) {
                await groupMemberApi.delete(groupMember.id);
                // Обновляем список участников
                await loadMembers(groupId);
                setSuccessMessage("Участник удален из группы");
                setTimeout(() => setSuccessMessage(null), 3000);
            }
        } catch (err) {
            console.error("Failed to remove member:", err);
            setError("Не удалось удалить участника");
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!window.confirm("Вы уверены, что хотите удалить группу?")) return;

        try {
            await groupApi.delete(groupId);
            setGroups(prev => prev.filter(g => g.group.id !== groupId));
            setSuccessMessage("Группа удалена");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            console.error("Failed to delete group:", err);
            setError("Не удалось удалить группу");
        }
    };

    const handleCreateGroup = () => {
        navigate("/groups/create");
    };

    const handleBack = () => {
        navigate("/");
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Загрузка...</p>
            </div>
        );
    }

    return (
        <div className="groups-page">
            <div className="groups-page-content">
                <div className="groups-page-header">
                    <button onClick={handleBack} className="back-button">
                        ← Назад
                    </button>
                </div>

                <div className="groups-section">
                    <div className="groups-section-header">
                        <h2 className="groups-section-title">Мои группы</h2>
                        <button onClick={handleCreateGroup} className="create-group-button">
                            + Создать группу
                        </button>
                    </div>

                    {error && <div className="form-error">{error}</div>}
                    {successMessage && <div className="form-success">{successMessage}</div>}

                    {groups.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-message">У вас пока нет групп</p>
                            <p className="empty-hint">Создайте группу, чтобы добавлять в неё участников</p>
                        </div>
                    ) : (
                        <div className="groups-list">
                            {groups.map(({ group, members, isExpanded, loadingMembers }) => (
                                <div key={group.id} className="group-card">
                                    <div
                                        className="group-header"
                                        onClick={() => handleToggleGroup(group.id)}
                                    >
                                        <div className="group-header-info">
                                            <span className="group-icon">👥</span>
                                            <div className="group-header-text">
                                                <h3 className="group-name">{group.title}</h3>
                                                {group.description && (
                                                    <p className="group-description">
                                                        {group.description.length > 80
                                                            ? group.description.substring(0, 80) + '...'
                                                            : group.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="group-header-actions" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                className="delete-group-button"
                                                onClick={() => handleDeleteGroup(group.id)}
                                                title="Удалить группу"
                                            >
                                                ✕
                                            </button>
                                            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                                                ▼
                                            </span>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="group-content">
                                            {/* Добавление участника */}
                                            <div className="add-member-section">
                                                {addingMemberGroupId === group.id ? (
                                                    <div className="add-member-form">
                                                        <input
                                                            type="email"
                                                            value={newMemberEmail}
                                                            onChange={(e) => {
                                                                setNewMemberEmail(e.target.value);
                                                                setMemberError(null);
                                                            }}
                                                            placeholder="Введите email участника"
                                                            className="member-email-input"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleAddMember(group.id);
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => handleAddMember(group.id)}
                                                            className="add-member-submit"
                                                            disabled={addingMember}
                                                        >
                                                            {addingMember ? "..." : "Добавить"}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setAddingMemberGroupId(null);
                                                                setNewMemberEmail("");
                                                                setMemberError(null);
                                                            }}
                                                            className="add-member-cancel"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setAddingMemberGroupId(group.id)}
                                                        className="add-member-button"
                                                    >
                                                        + Добавить участника
                                                    </button>
                                                )}
                                                {memberError && addingMemberGroupId === group.id && (
                                                    <div className="member-error">{memberError}</div>
                                                )}
                                            </div>

                                            {/* Список участников */}
                                            <div className="members-section">
                                                <h4 className="members-title">
                                                    Участники ({members.length})
                                                </h4>
                                                {loadingMembers ? (
                                                    <div className="members-loading">Загрузка участников...</div>
                                                ) : members.length === 0 ? (
                                                    <div className="members-empty">
                                                        <p>В группе пока нет участников</p>
                                                    </div>
                                                ) : (
                                                    <div className="members-list">
                                                        {members.map(member => (
                                                            <div key={member.id} className="member-item">
                                                                <div className="member-info">
                                                                    <div className="member-avatar">
                                                                        {member.full_name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="member-details">
                                                                        <span className="member-name">{member.full_name}</span>
                                                                        <span className="member-email">{member.email}</span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleRemoveMember(group.id, member.id)}
                                                                    className="remove-member-button"
                                                                    title="Удалить участника"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroupPage;