import api from "@/shared/api/axios.ts";

const GROUPS: string = "/groups";

export interface GroupResponse {
    id: string;
    title: string;
    description: string;
    owner_id: string;
}

export interface GroupListResponse {
    groups: GroupResponse[];
}

export const groupApi = {
    post: (title: string, description: string, owner_id: string) =>
        api.post<GroupResponse>(`${GROUPS}`, {
            title,
            description,
            owner_id,
        }),

    getMy: () =>
        api.get<GroupListResponse>(`${GROUPS}/my`),

    getById: (id: string) =>
        api.get<GroupResponse>(`${GROUPS}/${id}`),

    patch: (id: string, title: string, description: string) =>
        api.patch<GroupResponse>(
            `${GROUPS}/${id}`, {
                title,
                description,
            },
        ),

    delete: (id: string) =>
        api.delete<void>(`${GROUPS}/${id}`),
};