// CreateTestPage.tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { taskApi } from "@/shared/api/task";
import "./CreateTestPage.css";

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

interface TestOption {
    id: string;
    text: string;
    is_correct: boolean;
}

interface Question {
    id: string;
    title: string;
    type: "text_answer" | "single_choice" | "multiple_choice";
    correctTextAnswer: string;
    options: TestOption[];
}

const createEmptyQuestion = (): Question => ({
    id: crypto.randomUUID(),
    title: "",
    type: "single_choice",
    correctTextAnswer: "",
    options: [
        { id: crypto.randomUUID(), text: "", is_correct: false },
        { id: crypto.randomUUID(), text: "", is_correct: false },
    ],
});

const CreateTestPage = () => {
    // Используем useParams правильно
    const params = useParams();
    const navigate = useNavigate();

    // Определяем, с какого маршрута пришли
    // /modules/:moduleId/tests/create -> params.moduleId
    // /courses/:courseId/tests/create -> params.courseId
    const moduleId = params.moduleId;
    const courseId = params.courseId;

    const [questions, setQuestions] = useState<Question[]>([createEmptyQuestion()]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setQuestionErrors({});

        // Валидация всех вопросов
        let hasErrors = false;
        const errors: Record<string, string> = {};

        questions.forEach((question, index) => {
            if (!question.title.trim()) {
                errors[question.id] = `Вопрос ${index + 1}: название обязательно`;
                hasErrors = true;
                return;
            }

            const validOptions = question.options.filter(opt => opt.text.trim());

            if (question.type !== "text_answer" && validOptions.length < 2) {
                errors[question.id] = `Вопрос ${index + 1}: минимум 2 варианта ответа`;
                hasErrors = true;
                return;
            }

            if (question.type === "single_choice") {
                const correctCount = validOptions.filter(opt => opt.is_correct).length;
                if (correctCount !== 1) {
                    errors[question.id] = `Вопрос ${index + 1}: должен быть ровно один правильный ответ`;
                    hasErrors = true;
                    return;
                }
            }

            if (question.type === "multiple_choice") {
                const correctCount = validOptions.filter(opt => opt.is_correct).length;
                if (correctCount < 1) {
                    errors[question.id] = `Вопрос ${index + 1}: должен быть хотя бы один правильный ответ`;
                    hasErrors = true;
                    return;
                }
            }

            if (question.type === "text_answer" && !question.correctTextAnswer.trim()) {
                errors[question.id] = `Вопрос ${index + 1}: введите правильный ответ`;
                hasErrors = true;
                return;
            }
        });

        if (hasErrors) {
            setQuestionErrors(errors);
            setError("Исправьте ошибки в вопросах");
            return;
        }

        if (!moduleId && !courseId) {
            setError("Не удалось определить источник теста");
            return;
        }

        setLoading(true);

        try {
            const promises = questions.map((question, index) => {
                const validOptions = question.options.filter(opt => opt.text.trim());
                const questionTitle = question.title.trim() || `Вопрос ${index + 1}`;

                return taskApi.post(
                    questionTitle,
                    courseId || "",
                    moduleId || "",
                    question.type,
                    question.type === "text_answer" ? question.correctTextAnswer.trim() : "",
                    question.type !== "text_answer" ? validOptions : [],
                );
            });

            await Promise.all(promises);

            if (moduleId) {
                navigate(`/modules/${moduleId}`);
            } else if (courseId) {
                navigate(`/courses/${courseId}`);
            }
        } catch (err) {
            console.error("Failed to create test:", err);

            const apiError = err as ApiError;

            if (apiError.response?.status === 409) {
                setError("Вопрос с таким названием уже существует");
            } else {
                setError("Не удалось создать тест. Попробуйте позже.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        if (moduleId) {
            navigate(`/modules/${moduleId}`);
        } else if (courseId) {
            navigate(`/courses/${courseId}`);
        }
    };

    // Функции для работы с вопросами
    const handleAddQuestion = () => {
        if (questions.length >= 20) {
            setError("Максимальное количество вопросов: 20");
            return;
        }
        setQuestions([...questions, createEmptyQuestion()]);
    };

    const handleRemoveQuestion = (questionId: string) => {
        if (questions.length <= 1) {
            setError("Должен быть хотя бы один вопрос");
            return;
        }
        setQuestions(questions.filter(q => q.id !== questionId));
        const newErrors = { ...questionErrors };
        delete newErrors[questionId];
        setQuestionErrors(newErrors);
    };

    const handleQuestionTitleChange = (questionId: string, title: string) => {
        setQuestions(questions.map(q =>
            q.id === questionId ? { ...q, title } : q
        ));
        if (questionErrors[questionId]?.includes("название")) {
            const newErrors = { ...questionErrors };
            delete newErrors[questionId];
            setQuestionErrors(newErrors);
            if (Object.keys(newErrors).length === 0) {
                setError(null);
            }
        }
    };

    const handleQuestionTypeChange = (questionId: string, type: "text_answer" | "single_choice" | "multiple_choice") => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                return {
                    ...q,
                    type,
                    options: type !== "text_answer" && q.options.length < 2
                        ? [
                            { id: crypto.randomUUID(), text: "", is_correct: false },
                            { id: crypto.randomUUID(), text: "", is_correct: false },
                        ]
                        : q.options,
                };
            }
            return q;
        }));
        const newErrors = { ...questionErrors };
        delete newErrors[questionId];
        setQuestionErrors(newErrors);
        if (Object.keys(newErrors).length === 0) {
            setError(null);
        }
    };

    const handleCorrectTextAnswerChange = (questionId: string, text: string) => {
        setQuestions(questions.map(q =>
            q.id === questionId ? { ...q, correctTextAnswer: text } : q
        ));
    };

    const handleOptionTextChange = (questionId: string, optionIndex: number, text: string) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                const newOptions = [...q.options];
                newOptions[optionIndex] = { ...newOptions[optionIndex], text };
                return { ...q, options: newOptions };
            }
            return q;
        }));
    };

    const handleOptionCorrectChange = (questionId: string, optionIndex: number, isCorrect: boolean) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                const newOptions = [...q.options];

                if (q.type === "single_choice" && isCorrect) {
                    newOptions.forEach(opt => opt.is_correct = false);
                }

                newOptions[optionIndex] = { ...newOptions[optionIndex], is_correct: isCorrect };
                return { ...q, options: newOptions };
            }
            return q;
        }));
    };

    const handleAddOption = (questionId: string) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                if (q.options.length >= 10) {
                    setError("Максимальное количество вариантов: 10");
                    return q;
                }
                return {
                    ...q,
                    options: [...q.options, { id: crypto.randomUUID(), text: "", is_correct: false }],
                };
            }
            return q;
        }));
    };

    const handleRemoveOption = (questionId: string, optionIndex: number) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                if (q.options.length <= 2) {
                    setError("Минимальное количество вариантов: 2");
                    return q;
                }
                return {
                    ...q,
                    options: q.options.filter((_, i) => i !== optionIndex),
                };
            }
            return q;
        }));
    };

    return (
        <div className="create-test-page">
            <div className="create-test-card">
                <h1 className="create-test-title">Создание теста</h1>

                <form onSubmit={handleSubmit} className="create-test-form">
                    {/* Вопросы */}
                    <div className="questions-section">
                        {questions.map((question, qIndex) => (
                            <div key={question.id} className="question-card">
                                <div className="question-header">
                                    <span className="question-number">Вопрос {qIndex + 1}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveQuestion(question.id)}
                                        className="question-remove-button"
                                        disabled={loading || questions.length <= 1}
                                        title="Удалить вопрос"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="question-body">
                                    <input
                                        type="text"
                                        value={question.title}
                                        onChange={(e) => handleQuestionTitleChange(question.id, e.target.value)}
                                        placeholder="Введите текст вопроса"
                                        className={`form-input ${questionErrors[question.id] ? "form-input-error" : ""}`}
                                        disabled={loading}
                                    />

                                    <div className="type-selector">
                                        <button
                                            type="button"
                                            className={`type-button ${question.type === "single_choice" ? "active" : ""}`}
                                            onClick={() => handleQuestionTypeChange(question.id, "single_choice")}
                                            disabled={loading}
                                        >
                                            Один ответ
                                        </button>
                                        <button
                                            type="button"
                                            className={`type-button ${question.type === "multiple_choice" ? "active" : ""}`}
                                            onClick={() => handleQuestionTypeChange(question.id, "multiple_choice")}
                                            disabled={loading}
                                        >
                                            Несколько ответов
                                        </button>
                                        <button
                                            type="button"
                                            className={`type-button ${question.type === "text_answer" ? "active" : ""}`}
                                            onClick={() => handleQuestionTypeChange(question.id, "text_answer")}
                                            disabled={loading}
                                        >
                                            Текстовый ответ
                                        </button>
                                    </div>

                                    {question.type === "text_answer" ? (
                                        <input
                                            type="text"
                                            value={question.correctTextAnswer}
                                            onChange={(e) => handleCorrectTextAnswerChange(question.id, e.target.value)}
                                            placeholder="Введите правильный ответ"
                                            className={`form-input ${questionErrors[question.id] ? "form-input-error" : ""}`}
                                            disabled={loading}
                                        />
                                    ) : (
                                        <div className="question-options">
                                            {question.options.map((option, oIndex) => (
                                                <div key={option.id} className="option-item">
                                                    <div className="option-select">
                                                        {question.type === "single_choice" ? (
                                                            <input
                                                                type="radio"
                                                                name={`correct-${question.id}`}
                                                                checked={option.is_correct}
                                                                onChange={() => handleOptionCorrectChange(question.id, oIndex, true)}
                                                                className="option-radio"
                                                                disabled={loading}
                                                            />
                                                        ) : (
                                                            <input
                                                                type="checkbox"
                                                                checked={option.is_correct}
                                                                onChange={(e) => handleOptionCorrectChange(question.id, oIndex, e.target.checked)}
                                                                className="option-checkbox"
                                                                disabled={loading}
                                                            />
                                                        )}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={option.text}
                                                        onChange={(e) => handleOptionTextChange(question.id, oIndex, e.target.value)}
                                                        placeholder={`Вариант ${oIndex + 1}`}
                                                        className="option-input"
                                                        disabled={loading}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveOption(question.id, oIndex)}
                                                        className="option-remove-button"
                                                        disabled={loading || question.options.length <= 2}
                                                        title="Удалить вариант"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => handleAddOption(question.id)}
                                                className="add-option-button"
                                                disabled={loading || question.options.length >= 10}
                                            >
                                                + Добавить вариант
                                            </button>
                                        </div>
                                    )}

                                    {questionErrors[question.id] && (
                                        <div className="question-error">{questionErrors[question.id]}</div>
                                    )}
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={handleAddQuestion}
                            className="add-question-button"
                            disabled={loading || questions.length >= 20}
                        >
                            + Добавить вопрос
                        </button>
                    </div>

                    {error && !Object.keys(questionErrors).length && (
                        <div className="form-error">{error}</div>
                    )}

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
                            {loading ? "Создание..." : "Создать тест"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTestPage;