import api from "./axios.ts";

const BASE = "/terrain";

export interface LimitResponse {
    user_id: string;
    daily_limit: number;
    used_today: number;
    reset_at: string;
}

export interface SubmitJobResponse {
    job_id: string;
}

export interface JobStatusResponse {
    job_id: string;
    status: "pending" | "processing" | "done" | "failed";
    model_url: string;
    texture_url: string;
    trees_url?: string;
    error?: string;
    created_at: string;
}

export const terrainApi = {
    getLimit: () =>
        api.get<LimitResponse>(`${BASE}/limit`),

    submitJob: (formData: FormData) =>
        api.post<SubmitJobResponse>(`${BASE}/jobs`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),

    getJobStatus: (jobId: string) =>
        api.get<JobStatusResponse>(`${BASE}/jobs/${jobId}`),

    getHistory: () =>
        api.get<JobStatusResponse[]>(`${BASE}/jobs`),
};
