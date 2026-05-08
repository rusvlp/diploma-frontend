import { useEffect, useRef, useState } from "react";
import { terrainApi, type JobStatusResponse, type LimitResponse } from "@/shared/api/terrain";
import { TerrainViewer } from "@/components/TerrainViewer/TerrainViewer";
import "./TerrainPage.css";

const POLL_INTERVAL = 3000;

const toProxyUrl = (url: string) =>
    url.replace(/^https?:\/\/[^/]*:9000/, '/minio');

const TerrainPage = () => {
    const [limit, setLimit] = useState<LimitResponse | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [scaleZ, setScaleZ] = useState("0.3");
    const [yUp, setYUp] = useState(false);
    const [textureMode, setTextureMode] = useState<"photo" | "classified" | "terrain">("photo");
    const [submitting, setSubmitting] = useState(false);
    const [activeJob, setActiveJob] = useState<JobStatusResponse | null>(null);
    const [history, setHistory] = useState<JobStatusResponse[]>([]);
    const [selectedJob, setSelectedJob] = useState<JobStatusResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        terrainApi.getLimit().then(r => setLimit(r.data)).catch(console.error);
        terrainApi.getHistory().then(r => setHistory(r.data)).catch(console.error);
        return () => stopPolling();
    }, []);

    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    const startPolling = (jobId: string) => {
        stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const res = await terrainApi.getJobStatus(jobId);
                setActiveJob(res.data);
                if (res.data.status === "done" || res.data.status === "failed") {
                    stopPolling();
                    terrainApi.getLimit().then(r => setLimit(r.data)).catch(console.error);
                    terrainApi.getHistory().then(r => setHistory(r.data)).catch(console.error);
                    if (res.data.status === "done") setSelectedJob(res.data);
                }
            } catch { stopPolling(); }
        }, POLL_INTERVAL);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        setFile(f);
        setPreview(f ? URL.createObjectURL(f) : null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;
        setSubmitting(true);
        setError(null);
        const fd = new FormData();
        fd.append("image", file);
        fd.append("scale_z", scaleZ);
        fd.append("y_up", String(yUp));
        fd.append("texture_mode", textureMode);
        try {
            const res = await terrainApi.submitJob(fd);
            setActiveJob({ job_id: res.data.job_id, status: "pending", model_url: "", texture_url: "", created_at: new Date().toISOString() });
            setSelectedJob(null);
            startPolling(res.data.job_id);
        } catch (err: any) {
            setError(err.response?.data?.error ?? "Ошибка при отправке задачи");
        } finally {
            setSubmitting(false);
        }
    };

    const limitExhausted = limit && limit.used_today >= limit.daily_limit;
    const viewJob = selectedJob ?? (activeJob?.status === "done" ? activeJob : null);

    return (
        <div className="tp-root">
            {/* LEFT — панель управления */}
            <aside className="tp-panel">

                {/* Форма */}
                <div className="tp-section">
                    <h2 className="tp-title">Генерация ландшафта</h2>

                    <form className="tp-form" onSubmit={handleSubmit}>
                        <label className="tp-upload" htmlFor="img-input">
                            {preview
                                ? <img src={preview} alt="preview" className="tp-preview" />
                                : <span className="tp-upload-hint">Выберите спутниковый снимок<br />(JPG, PNG)</span>
                            }
                        </label>
                        <input id="img-input" type="file" accept="image/*" className="tp-hidden" onChange={handleFileChange} />

                        <div className="tp-params">
                            <label className="tp-param-label">
                                Вертикальный масштаб
                                <input type="number" className="tp-input" value={scaleZ} step="0.01" min="0.01" max="5"
                                    onChange={e => setScaleZ(e.target.value)} />
                            </label>
                            <label className="tp-param-label">
                                Текстура
                                <select className="tp-input" value={textureMode}
                                    onChange={e => setTextureMode(e.target.value as typeof textureMode)}>
                                    <option value="photo">Спутниковый снимок</option>
                                    <option value="classified">Семантическая карта</option>
                                    <option value="terrain">Карта высот</option>
                                </select>
                            </label>
                            <label className="tp-checkbox">
                                <input type="checkbox" checked={yUp} onChange={e => setYUp(e.target.checked)} />
                                Y-up оси (Unity / Godot)
                            </label>
                        </div>

                        {error && <p className="tp-error">{error}</p>}

                        <button type="submit" className="tp-submit" disabled={!file || submitting || !!limitExhausted}>
                            {submitting ? "Отправка..." : "Сгенерировать"}
                        </button>
                    </form>

                    {activeJob && (activeJob.status === "pending" || activeJob.status === "processing") && (
                        <div className="tp-active-job">
                            <div className="tp-shimmer" />
                            <p className="tp-active-hint">Генерация займёт 1–3 минуты…</p>
                        </div>
                    )}

                    {viewJob && viewJob.model_url && (
                        <div className="tp-downloads">
                            <a href={viewJob.model_url} className="tp-dl-link" download>Скачать 3D модель (.obj)</a>
                            <a href={viewJob.texture_url} className="tp-dl-link" download>Скачать текстуру (.png)</a>
                        </div>
                    )}
                </div>

                {/* Лимит */}
                {limit && (
                    <div className="tp-section tp-limit">
                        <div className="tp-limit-row">
                            <span>Использовано сегодня</span>
                            <span className={`tp-limit-val${limitExhausted ? " exhausted" : ""}`}>
                                {limit.used_today} / {limit.daily_limit}
                            </span>
                        </div>
                        <div className="tp-limit-bar-wrap">
                            <div className="tp-limit-bar" style={{ width: `${Math.min(100, (limit.used_today / limit.daily_limit) * 100)}%` }} />
                        </div>
                        <span className="tp-limit-reset">Сброс: {new Date(limit.reset_at).toLocaleString("ru-RU")}</span>
                    </div>
                )}

                {/* История — занимает оставшееся место, прокручивается */}
                <div className="tp-history-wrap">
                    <h3 className="tp-history-title">История генераций</h3>
                    <div className="tp-history-scroll">
                        {history.length === 0
                            ? <p className="tp-history-empty">Нет генераций</p>
                            : (
                                <ul className="tp-history-list">
                                    {history.map(j => (
                                        <li
                                            key={j.job_id}
                                            className={`tp-hi-item s-${j.status}${selectedJob?.job_id === j.job_id ? " active" : ""}`}
                                            onClick={() => j.status === "done" && setSelectedJob(j)}
                                        >
                                            <div className="tp-hi-row">
                                                <span className="tp-hi-id">{j.job_id.slice(0, 8)}…</span>
                                                <span className={`tp-hi-badge s-${j.status}`}>{statusLabel(j.status)}</span>
                                            </div>
                                            <span className="tp-hi-date">{new Date(j.created_at).toLocaleString("ru-RU")}</span>
                                        </li>
                                    ))}
                                </ul>
                            )
                        }
                    </div>
                </div>

            </aside>

            {/* RIGHT — предпросмотр на всё пространство */}
            <main className="tp-viewer">
                {viewJob && viewJob.model_url ? (
                    <TerrainViewer
                        objUrl={toProxyUrl(viewJob.model_url)}
                        textureUrl={toProxyUrl(viewJob.texture_url)}
                        treesUrl={viewJob.trees_url ? toProxyUrl(viewJob.trees_url) : undefined}
                    />
                ) : (
                    <div className="tp-empty-viewer">
                        <span>Здесь появится 3D предпросмотр</span>
                    </div>
                )}
            </main>
        </div>
    );
};

function statusLabel(s: JobStatusResponse["status"]): string {
    return { pending: "В очереди", processing: "Генерация", done: "Готово", failed: "Ошибка" }[s];
}

export default TerrainPage;
