// CreateLessonPage.tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { lessonApi } from "@/shared/api/lesson";
import { fileApi } from "@/shared/api/file";
import "./CreateLessonPage.css";

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

// Модальное окно для вставки таблицы
const InsertTableModal = ({
                              isOpen,
                              onClose,
                              onInsert
                          }: {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (rows: number, cols: number) => void;
}) => {
    const [rows, setRows] = useState(3);
    const [cols, setCols] = useState(3);
    const [localError, setLocalError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleInsert = () => {
        if (rows < 1 || cols < 1) {
            setLocalError("Количество строк и столбцов должно быть больше 0");
            return;
        }
        if (rows > 20 || cols > 20) {
            setLocalError("Максимальное количество строк и столбцов: 20");
            return;
        }
        onInsert(rows, cols);
        setRows(3);
        setCols(3);
        setLocalError(null);
    };

    const handleClose = () => {
        setRows(3);
        setCols(3);
        setLocalError(null);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">Вставка таблицы</h3>
                <p className="modal-text">Укажите размеры таблицы:</p>

                <div className="table-form">
                    <div className="table-form-group">
                        <label className="table-form-label">Количество строк:</label>
                        <input
                            type="number"
                            value={rows}
                            onChange={(e) => {
                                setRows(Number(e.target.value));
                                setLocalError(null);
                            }}
                            className="table-form-input"
                            min="1"
                            max="20"
                        />
                    </div>
                    <div className="table-form-group">
                        <label className="table-form-label">Количество столбцов:</label>
                        <input
                            type="number"
                            value={cols}
                            onChange={(e) => {
                                setCols(Number(e.target.value));
                                setLocalError(null);
                            }}
                            className="table-form-input"
                            min="1"
                            max="20"
                        />
                    </div>

                    {localError && <div className="table-form-error">{localError}</div>}

                    <div className="table-preview">
                        <table>
                            <tbody>
                            {Array.from({ length: Math.min(rows, 5) }, (_, i) => (
                                <tr key={i}>
                                    {Array.from({ length: Math.min(cols, 5) }, (_, j) => (
                                        <td key={j} className="preview-cell"></td>
                                    ))}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        {(rows > 5 || cols > 5) && (
                            <p className="preview-note">
                                И ещё {rows > 5 ? rows - 5 : 0} строк{rows > 5 && cols > 5 ? ' и' : ''} {cols > 5 ? cols - 5 : 0} столбцов
                            </p>
                        )}
                    </div>
                </div>

                <div className="modal-actions">
                    <button onClick={handleClose} className="modal-cancel-button">
                        Отмена
                    </button>
                    <button onClick={handleInsert} className="modal-confirm-button insert-table-button">
                        Вставить таблицу
                    </button>
                </div>
            </div>
        </div>
    );
};

const CreateLessonPage = () => {
    const { id: moduleId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
    const [currentFontSize, setCurrentFontSize] = useState<string>("3");
    const savedSelectionRef = useRef<Range | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Состояние для файлов
    const [files, setFiles] = useState<File[]>([]);

    // Состояние для модального окна таблицы
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError("Название урока обязательно");
            return;
        }

        if (!moduleId) {
            setError("ID модуля не найден");
            return;
        }

        setLoading(true);

        try {
            // Создаем урок
            const response = await lessonApi.post(
                title.trim(),
                description.trim(),
                contentRef.current?.innerHTML || "",
                moduleId,
            );

            const lessonId = response.data.id;

            // Загружаем файлы, если они есть
            if (files.length > 0) {
                const uploadPromises = files.map(file =>
                    fileApi.post(lessonId, file)
                        .catch(err => {
                            console.error(`Failed to upload file ${file.name}:`, err);
                            return null;
                        })
                );

                await Promise.all(uploadPromises);
            }

            navigate(`/lessons/${lessonId}`);
        } catch (err) {
            console.error("Failed to create lesson:", err);

            const apiError = err as ApiError;

            if (apiError.response?.status === 409) {
                setError("Урок с таким названием уже существует. Выберите другое название для урока");
            } else {
                setError("Не удалось создать урок. Попробуйте позже.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        navigate(`/modules/${moduleId}`);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        if (error?.includes("название")) {
            setError(null);
        }
    };

    // Обработка выбора файлов
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);

        // Проверка размера файлов (20 МБ)
        const maxSize = 20 * 1024 * 1024;
        const oversizedFiles = selectedFiles.filter(file => file.size > maxSize);

        if (oversizedFiles.length > 0) {
            setError(`Файлы превышают максимальный размер 20 МБ: ${oversizedFiles.map(f => f.name).join(', ')}`);
            return;
        }

        setFiles(prev => [...prev, ...selectedFiles]);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Удаление файла из списка
    const handleRemoveFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Форматирование размера файла
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Б';
        const k = 1024;
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Обновление активных форматов
    const updateActiveFormats = useCallback(() => {
        const formats = new Set<string>();

        if (document.queryCommandState('bold')) formats.add('bold');
        if (document.queryCommandState('italic')) formats.add('italic');
        if (document.queryCommandState('underline')) formats.add('underline');
        if (document.queryCommandState('strikeThrough')) formats.add('strikeThrough');
        if (document.queryCommandState('justifyLeft')) formats.add('justifyLeft');
        if (document.queryCommandState('justifyCenter')) formats.add('justifyCenter');
        if (document.queryCommandState('justifyRight')) formats.add('justifyRight');
        if (document.queryCommandState('insertOrderedList')) formats.add('insertOrderedList');
        if (document.queryCommandState('insertUnorderedList')) formats.add('insertUnorderedList');

        const fontSize = document.queryCommandValue('fontSize');
        if (fontSize) {
            setCurrentFontSize(fontSize);
        }

        setActiveFormats(formats);
    }, []);

    const handleContentChange = useCallback(() => {
        updateActiveFormats();
        if (error?.includes("Содержание")) {
            setError(null);
        }
    }, [updateActiveFormats, error]);

    const execCommand = (command: string, value?: string) => {
        contentRef.current?.focus();
        document.execCommand(command, false, value);
        updateActiveFormats();
    };

    const changeFontSize = (size: string) => {
        contentRef.current?.focus();
        document.execCommand('fontSize', false, size);
        setCurrentFontSize(size);
        updateActiveFormats();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    execCommand('bold');
                    break;
                case 'i':
                    e.preventDefault();
                    execCommand('italic');
                    break;
                case 'u':
                    e.preventDefault();
                    execCommand('underline');
                    break;
            }
        }
    };

    // Сохранение текущего выделения
    const saveSelection = useCallback(() => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && contentRef.current) {
            const range = selection.getRangeAt(0);
            if (contentRef.current.contains(range.commonAncestorContainer)) {
                savedSelectionRef.current = range.cloneRange();
            }
        }
    }, []);

    // Восстановление сохраненного выделения
    const restoreSelection = useCallback(() => {
        if (savedSelectionRef.current && contentRef.current) {
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(savedSelectionRef.current);
                contentRef.current.focus();
            }
        } else {
            contentRef.current?.focus();
            const selection = window.getSelection();
            if (selection && contentRef.current) {
                const range = document.createRange();
                range.selectNodeContents(contentRef.current);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }, []);

    const handleInsertTable = useCallback((rows: number, cols: number) => {
        restoreSelection();

        let tableHTML = '<table border="1" style="border-collapse: collapse; width: 100%;">';

        for (let i = 0; i < rows; i++) {
            tableHTML += '<tr>';
            for (let j = 0; j < cols; j++) {
                tableHTML += '<td style="padding: 8px; border: 1px solid #ddd;"><br></td>';
            }
            tableHTML += '</tr>';
        }

        tableHTML += '</table><p><br></p>';

        document.execCommand('insertHTML', false, tableHTML);
        updateActiveFormats();
        setIsTableModalOpen(false);
    }, [restoreSelection, updateActiveFormats]);

    // Обновление форматов при изменении выделения
    useEffect(() => {
        const handleSelectionChange = () => {
            updateActiveFormats();
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [updateActiveFormats]);

    const fontSizeOptions = [
        { value: "1", label: "Маленький" },
        { value: "2", label: "Малый" },
        { value: "3", label: "Обычный" },
        { value: "4", label: "Средний" },
        { value: "5", label: "Крупный" },
        { value: "6", label: "Большой" },
        { value: "7", label: "Огромный" },
    ];

    return (
        <div className="create-lesson-page">
            <div className="create-lesson-card">
                <h1 className="create-lesson-title">Создание нового урока</h1>

                <form onSubmit={handleSubmit} className="create-lesson-form">
                    <div className="form-group">
                        <label htmlFor="title" className="form-label">
                            Название урока *
                        </label>
                        <input
                            id="title"
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder="Введите название урока"
                            className={`form-input ${error?.includes("название") ? "form-input-error" : ""}`}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description" className="form-label">
                            Описание урока
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
                            placeholder="Введите описание урока (необязательно)"
                            className={`form-textarea ${error?.includes("Описание") ? "form-input-error" : ""}`}
                            rows={4}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            Содержание урока
                        </label>
                        <div className="editor-toolbar">
                            <button
                                type="button"
                                className={`toolbar-button ${activeFormats.has('bold') ? 'active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    execCommand('bold');
                                }}
                                title="Жирный (Ctrl+B)"
                            >
                                <strong>B</strong>
                            </button>
                            <button
                                type="button"
                                className={`toolbar-button ${activeFormats.has('italic') ? 'active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    execCommand('italic');
                                }}
                                title="Курсив (Ctrl+I)"
                            >
                                <em>I</em>
                            </button>
                            <button
                                type="button"
                                className={`toolbar-button ${activeFormats.has('underline') ? 'active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    execCommand('underline');
                                }}
                                title="Подчеркнутый (Ctrl+U)"
                            >
                                <u>U</u>
                            </button>
                            <button
                                type="button"
                                className={`toolbar-button ${activeFormats.has('strikeThrough') ? 'active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    execCommand('strikeThrough');
                                }}
                                title="Зачеркнутый"
                            >
                                <s>S</s>
                            </button>

                            <span className="toolbar-divider"></span>

                            <select
                                className="font-size-select"
                                value={currentFontSize}
                                onChange={(e) => changeFontSize(e.target.value)}
                                title="Размер текста"
                            >
                                {fontSizeOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>

                            <span className="toolbar-divider"></span>

                            <button
                                type="button"
                                className={`toolbar-button ${activeFormats.has('justifyLeft') ? 'active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    execCommand('justifyLeft');
                                }}
                                title="По левому краю"
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                    <rect x="0" y="1" width="14" height="2" rx="0.5"/>
                                    <rect x="0" y="5" width="10" height="2" rx="0.5"/>
                                    <rect x="0" y="9" width="12" height="2" rx="0.5"/>
                                </svg>
                            </button>
                            <button
                                type="button"
                                className={`toolbar-button ${activeFormats.has('justifyCenter') ? 'active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    execCommand('justifyCenter');
                                }}
                                title="По центру"
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                    <rect x="0" y="1" width="14" height="2" rx="0.5"/>
                                    <rect x="2" y="5" width="10" height="2" rx="0.5"/>
                                    <rect x="1" y="9" width="12" height="2" rx="0.5"/>
                                </svg>
                            </button>
                            <button
                                type="button"
                                className={`toolbar-button ${activeFormats.has('justifyRight') ? 'active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    execCommand('justifyRight');
                                }}
                                title="По правому краю"
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                                    <rect x="0" y="1" width="14" height="2" rx="0.5"/>
                                    <rect x="4" y="5" width="10" height="2" rx="0.5"/>
                                    <rect x="2" y="9" width="12" height="2" rx="0.5"/>
                                </svg>
                            </button>

                            <span className="toolbar-divider"></span>

                            <button
                                type="button"
                                className={`toolbar-button ${activeFormats.has('insertOrderedList') ? 'active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    execCommand('insertOrderedList');
                                }}
                                title="Нумерованный список"
                            >
                                1.
                            </button>
                            <button
                                type="button"
                                className={`toolbar-button ${activeFormats.has('insertUnorderedList') ? 'active' : ''}`}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    execCommand('insertUnorderedList');
                                }}
                                title="Маркированный список"
                            >
                                •
                            </button>

                            <span className="toolbar-divider"></span>

                            <button
                                type="button"
                                className="toolbar-button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    saveSelection();
                                    setIsTableModalOpen(true);
                                }}
                                title="Вставить таблицу"
                            >
                                ⊞
                            </button>
                            <button
                                type="button"
                                className="toolbar-button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    execCommand('removeFormat');
                                }}
                                title="Очистить форматирование"
                            >
                                ✕
                            </button>
                        </div>
                        <div
                            ref={contentRef}
                            className={`editor-content ${error?.includes("Содержание") ? "form-input-error" : ""}`}
                            contentEditable={!loading}
                            onInput={handleContentChange}
                            onKeyDown={handleKeyDown}
                            onKeyUp={updateActiveFormats}
                            onClick={updateActiveFormats}
                            data-placeholder="Введите содержание урока (необязательно)..."
                            suppressContentEditableWarning={true}
                        />
                    </div>

                    {/* Секция загрузки файлов */}
                    <div className="form-group">
                        <label className="form-label">
                            Файлы урока
                        </label>
                        <div className="file-upload-section">
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={handleFileSelect}
                                className="file-input-hidden"
                                id="file-upload"
                                disabled={loading}
                            />
                            <label htmlFor="file-upload" className="file-upload-button">
                                📎 Выбрать файлы
                            </label>
                            <span className="file-upload-hint">
                                Максимальный размер файла: 20 МБ
                            </span>
                        </div>

                        {files.length > 0 && (
                            <div className="file-list">
                                {files.map((file, index) => (
                                    <div key={`${file.name}-${index}`} className="file-item">
                                        <div className="file-info">
                                            <span className="file-icon">📄</span>
                                            <div className="file-details">
                                                <span className="file-name">{file.name}</span>
                                                <span className="file-size">{formatFileSize(file.size)}</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(index)}
                                            className="file-remove-button"
                                            disabled={loading}
                                            title="Удалить файл"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
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
                            {loading ? "Создание..." : "Создать урок"}
                        </button>
                    </div>
                </form>
            </div>

            <InsertTableModal
                isOpen={isTableModalOpen}
                onClose={() => setIsTableModalOpen(false)}
                onInsert={handleInsertTable}
            />
        </div>
    );
};

export default CreateLessonPage;