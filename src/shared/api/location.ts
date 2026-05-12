import api from "./axios.ts";

const BASE = "/locations";

export interface BrushTree {
    wx: number;
    wy: number;
    wz: number;
    s: number;
}

export interface RemovedZone {
    x: number;
    z: number;
    r: number;
}

export interface CreateLocationRequest {
    job_id: string;
    name: string;
    scale_z: number;
    water_enabled: boolean;
    water_level: number;
    tree_count_percent: number;
    crown_height_scale: number;
    crown_radius_scale: number;
    trunk_radius_scale: number;
    extra_trees: BrushTree[];
    removed_positions: RemovedZone[];
}

export interface UpdateLocationRequest {
    name: string;
    scale_z: number;
    water_enabled: boolean;
    water_level: number;
    tree_count_percent: number;
    crown_height_scale: number;
    crown_radius_scale: number;
    trunk_radius_scale: number;
    extra_trees: BrushTree[];
    removed_positions: RemovedZone[];
}

export interface LocationResponse {
    id: string;
    user_id: string;
    job_id: string;
    name: string;
    scale_z: number;
    water_enabled: boolean;
    water_level: number;
    tree_count_percent: number;
    crown_height_scale: number;
    crown_radius_scale: number;
    trunk_radius_scale: number;
    extra_trees: BrushTree[];
    removed_positions: RemovedZone[];
    model_url?: string;
    texture_url?: string;
    trees_url?: string;
    created_at: string;
    updated_at: string;
}

export const locationApi = {
    create: (data: CreateLocationRequest) =>
        api.post<LocationResponse>(BASE, data),

    list: () =>
        api.get<LocationResponse[]>(BASE),

    update: (id: string, data: UpdateLocationRequest) =>
        api.patch<LocationResponse>(`${BASE}/${id}`, data),

    remove: (id: string) =>
        api.delete(`${BASE}/${id}`),
};
