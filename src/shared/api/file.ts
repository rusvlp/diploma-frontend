import api from "./axios.ts";

const FILES = "/lessons/files";

export interface FileResponse {
    id: string;
    object_name: string;
    url: string;
}

export interface FileListResponse {
    files: FileResponse[];
}

export const fileApi = {
    post: (lesson_id: string, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("lesson_id", lesson_id);

        return api.post<FileResponse>(FILES, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
    },

    getByLessonId: (lesson_id: string) =>
        api.get<FileListResponse>(`${FILES}/${lesson_id}`),


    delete: (id: string, objectName: string) =>
        api.delete<void>(`${FILES}/${id}`, {
            data: {
                object_name: objectName,
            },
        }),
}