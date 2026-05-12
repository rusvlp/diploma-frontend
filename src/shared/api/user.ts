import api from "./axios.ts";

const USERS: string = "/users";

export interface UserResponse {
    id: string;
    full_name: string;
    role: "student" | "teacher" | "admin";
    email: string;
}

export interface UserListResponse {
    users: UserResponse[];
}

export const userApi = {
    getMe: () =>
        api.get<UserResponse>(`${USERS}/me`),

    getById: (id: string) =>
        api.get<UserResponse>(`${USERS}/${id}`),

    getAll: () =>
        api.get<UserListResponse>(`${USERS}/all`),

    patch: (full_name: string, email: string) =>
        api.patch<UserResponse>(`${USERS}`,{
            full_name,
            email,
        }),

    patchRole: (user_id: string, role: string) =>
        api.patch<UserResponse>(`${USERS}/role`, {
            user_id,
            role,
        }),

    patchPassword: (password: string) =>
        api.patch<UserResponse>(`${USERS}/password`, {
            password,
        })
};