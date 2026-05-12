import api from "@/shared/api/axios.ts";

const GROUP_MEMBERS: string = "/group-members";

export interface GroupMemberResponse {
    id: string;
    user_id: string;
    group_id: string;
    email: string;
}

export interface GroupMemberListResponse {
    group_members: GroupMemberResponse[];
}

export const groupMemberApi = {
    post: (email: string, group_id: string) =>
        api.post<GroupMemberResponse>(
            `${GROUP_MEMBERS}`, {
                email,
                group_id,
            },
        ),

    getAllByGroupId: (group_id: string) =>
        api.get<GroupMemberListResponse>(`${GROUP_MEMBERS}/${group_id}`),

    delete: (id: string) =>
        api.delete<void>(`${GROUP_MEMBERS}/${id}`),
};