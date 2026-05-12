import api from "@/shared/api/axios.ts";

const TASKS: string = "/tasks";

export interface TaskOption {
    id: string;
    text: string;
    is_correct: boolean;
}

export interface TaskResponse {
    id: string;

    title: string;

    course_id: string;
    module_id: string;

    type: string;

    correct_text_answer: string;

    options: TaskOption[];

}

export interface TaskListResponse {
    tasks: TaskResponse[];
}

export const taskApi = {
    post: (title: string, course_id: string, module_id: string, type: string, correct_text_answer: string, options: TaskOption[],) =>
        api.post<TaskResponse>(`${TASKS}`, {
            title,
            course_id,
            module_id,
            type,
            correct_text_answer,
            options,
        }),

    getById: (id: string) =>
        api.get<TaskResponse>(`${TASKS}/${id}`),

    getAllByCourseId: (course_id: string) =>
        api.get<TaskListResponse>(
            `${TASKS}/courses/${course_id}`,
        ),

    getAllByModuleId: (module_id: string) =>
        api.get<TaskListResponse>(
            `${TASKS}/modules/${module_id}`,
        ),

    patch: (id: string, title: string, correct_text_answer: string, options: TaskOption[],) =>
        api.patch<TaskResponse>(`${TASKS}/${id}`, {
            title,
            correct_text_answer,
            options,
        }),

    delete: (id: string) =>
        api.delete<void>(`${TASKS}/${id}`),
};