import api from "@/shared/api/axios.ts";

const TASK_ATTEMPTS: string = "/task-attempts";

export interface TaskAttemptAnswerRequest {
    task_id: string;
    text_answer: string;
    selected_option_ids: string[];
}

export interface TaskAttemptAnswerResponse {
    task_id: string;
    text_answer: string;
    selected_option_ids: string[];
    is_correct: boolean;
}

export interface TaskAttemptResponse {
    id: string;

    user_id: string;
    course_id: string;
    module_id: string;

    attempt_number: number;
    answers: TaskAttemptAnswerResponse[];
    correct_answers: number;
    total_questions: number;
    score: number;
}

export interface TaskAttemptListResponse {
    task_attempts: TaskAttemptResponse[];
}

export const taskAttemptApi = {
    submit: (user_id: string, course_id: string, module_id: string, answers: TaskAttemptAnswerRequest[]) =>
        api.post<TaskAttemptResponse>(`${TASK_ATTEMPTS}`, {
                user_id,
                course_id,
                module_id,
                answers,
            },
        ),

    getById: (id: string) =>
        api.get<TaskAttemptResponse>(`${TASK_ATTEMPTS}/${id}`),

    getMyByCourseId: (course_id: string) =>
        api.get<TaskAttemptListResponse>(`${TASK_ATTEMPTS}/courses/${course_id}`,),

    getMyByModuleId: (module_id: string) =>
        api.get<TaskAttemptListResponse>(`${TASK_ATTEMPTS}/modules/${module_id}`),

    getByUserIdAndCourseId: (user_id: string, course_id: string) =>
        api.get<TaskAttemptListResponse>(
            `${TASK_ATTEMPTS}/users/${user_id}/courses/${course_id}`,
        ),

    getByUserIdAndModuleId: (user_id: string, module_id: string) =>
        api.get<TaskAttemptListResponse>(`${TASK_ATTEMPTS}/users/${user_id}/modules/${module_id}`),
};