import api from "@/shared/api/axios.ts";

const GROUP_COURSES: string = "/group-courses";

export interface GroupCourseResponse {
    id: string;
    group_id: string;
    course_id: string;
}

export interface GroupCourseListResponse {
    group_courses: GroupCourseResponse[];
}

export const groupCourseApi = {
    post: (group_id: string, course_id: string) =>
        api.post<GroupCourseResponse>(`${GROUP_COURSES}`, {
                group_id,
                course_id,
            },
        ),

    getByCourseId: (courseId: string) =>
        api.get<GroupCourseListResponse>(`${GROUP_COURSES}/${courseId}`),

    delete: (id: string) =>
        api.delete<void>(`${GROUP_COURSES}/${id}`),
};