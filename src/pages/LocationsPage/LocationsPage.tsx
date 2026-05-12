import { useEffect, useRef, useState } from "react";
import { locationApi, type LocationResponse, type UpdateLocationRequest } from "@/shared/api/location";
import { TerrainViewer, type TerrainViewerHandle } from "@/components/TerrainViewer/TerrainViewer";
import "./LocationsPage.css";

const toProxyUrl = (url: string) =>
    url.replace(/^https?:\/\/[^/]*:9000/, '/minio');

const LocationsPage = () => {
    const [locations, setLocations] = useState<LocationResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLoc, setSelectedLoc] = useState<LocationResponse | null>(null);
    const [editing, setEditing] = useState(false);

    const [editName, setEditName] = useState("");
    const [editScaleZ, setEditScaleZ] = useState(0.3);
    const [editWaterEnabled, setEditWaterEnabled] = useState(false);
    const [editWaterLevel, setEditWaterLevel] = useState(0.1);
    const [editTreeCount, setEditTreeCount] = useState(100);
    const [editCrownH, setEditCrownH] = useState(1.0);
    const [editCrownR, setEditCrownR] = useState(1.0);
    const [editTrunkR, setEditTrunkR] = useState(1.0);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);

    const [brushMode, setBrushMode] = useState<'add' | 'erase' | null>(null);
    const [brushRadius, setBrushRadius] = useState(0.05);
    const [brushDensity, setBrushDensity] = useState(3);

    const viewerRef = useRef<TerrainViewerHandle>(null);

    useEffect(() => {
        locationApi.list()
            .then(r => { setLocations(r.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleSelect = (loc: LocationResponse) => {
        setBrushMode(null);
        viewerRef.current?.clearManualTrees();
        setSelectedLoc(loc);
        setEditing(false);
        setEditName(loc.name);
        setEditScaleZ(loc.scale_z);
        setEditWaterEnabled(loc.water_enabled);
        setEditWaterLevel(loc.water_level);
        setEditTreeCount(loc.tree_count_percent);
        setEditCrownH(loc.crown_height_scale ?? 1);
        setEditCrownR(loc.crown_radius_scale ?? 1);
        setEditTrunkR(loc.trunk_radius_scale ?? 1);
        setSaveMsg(null);
    };

    const handleSave = async () => {
        if (!selectedLoc) return;
        setSaving(true);
        setSaveMsg(null);
        const brushState = viewerRef.current?.getManualState() ?? { added: [], removed: [] };
        const req: UpdateLocationRequest = {
            name: editName,
            scale_z: editScaleZ,
            water_enabled: editWaterEnabled,
            water_level: editWaterLevel,
            tree_count_percent: editTreeCount,
            crown_height_scale: editCrownH,
            crown_radius_scale: editCrownR,
            trunk_radius_scale: editTrunkR,
            extra_trees: brushState.added,
            removed_positions: brushState.removed,
        };
        try {
            const res = await locationApi.update(selectedLoc.id, req);
            const updated = {
                ...res.data,
                model_url: selectedLoc.model_url,
                texture_url: selectedLoc.texture_url,
                trees_url: selectedLoc.trees_url,
            };
            setSelectedLoc(updated);
            setLocations(prev => prev.map(l => l.id === updated.id ? updated : l));
            setSaveMsg("Сохранено!");
            setEditing(false);
            setTimeout(() => setSaveMsg(null), 2500);
        } catch {
            setSaveMsg("Ошибка сохранения");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Удалить локацию?")) return;
        await locationApi.remove(id);
        setLocations(prev => prev.filter(l => l.id !== id));
        if (selectedLoc?.id === id) setSelectedLoc(null);
    };

    return (
        <div className="lp-root">
            <aside className="lp-panel">
                <h2 className="lp-title">Локации</h2>
                {loading && <p className="lp-empty">Загрузка…</p>}
                {!loading && locations.length === 0 && (
                    <p className="lp-empty">Нет сохранённых локаций</p>
                )}
                <ul className="lp-list">
                    {locations.map(loc => (
                        <li
                            key={loc.id}
                            className={`lp-item${selectedLoc?.id === loc.id ? " active" : ""}`}
                            onClick={() => handleSelect(loc)}
                        >
                            <div className="lp-item-row">
                                <span className="lp-item-name">{loc.name}</span>
                                <button
                                    className="lp-del-btn"
                                    onClick={e => { e.stopPropagation(); handleDelete(loc.id); }}
                                    title="Удалить"
                                >
                                    ×
                                </button>
                            </div>
                            <span className="lp-item-date">{new Date(loc.created_at).toLocaleString("ru-RU")}</span>
                            <div className="lp-item-meta">
                                <span>масштаб {loc.scale_z.toFixed(2)}</span>
                                {loc.water_enabled && <span>· вода</span>}
                                <span>· деревья {loc.tree_count_percent}%</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </aside>

            <main className="lp-viewer">
                {selectedLoc && selectedLoc.model_url ? (
                    <>
                        <TerrainViewer
                            ref={viewerRef}
                            objUrl={toProxyUrl(selectedLoc.model_url)}
                            textureUrl={toProxyUrl(selectedLoc.texture_url ?? "")}
                            treesUrl={selectedLoc.trees_url ? toProxyUrl(selectedLoc.trees_url) : undefined}
                            scaleZ={editScaleZ}
                            waterEnabled={editWaterEnabled}
                            waterLevel={editWaterLevel}
                            visibleTreeFraction={editTreeCount / 100}
                            crownHeightScale={editCrownH}
                            crownRadiusScale={editCrownR}
                            trunkRadiusScale={editTrunkR}
                            brushMode={brushMode}
                            brushRadius={brushRadius}
                            brushDensity={brushDensity}
                            savedExtraTrees={selectedLoc.extra_trees ?? []}
                            savedRemovedZones={selectedLoc.removed_positions ?? []}
                        />

                        <div className="lp-settings-card">
                            {/* Brush controls */}
                            <div className="lp-brush-row">
                                <button
                                    className={`lp-brush-btn${brushMode === 'add' ? ' active' : ''}`}
                                    onClick={() => setBrushMode(m => m === 'add' ? null : 'add')}
                                    title="Добавить деревья кистью"
                                >
                                    ✏ Добавить
                                </button>
                                <button
                                    className={`lp-brush-btn lp-brush-erase-btn${brushMode === 'erase' ? ' active' : ''}`}
                                    onClick={() => setBrushMode(m => m === 'erase' ? null : 'erase')}
                                    title="Стереть деревья (включая авто)"
                                >
                                    ⌫ Ластик
                                </button>
                                {brushMode && (
                                    <button
                                        className="lp-brush-clear-btn"
                                        onClick={() => viewerRef.current?.clearManualTrees()}
                                        title="Сбросить все изменения кисти"
                                    >
                                        Сброс
                                    </button>
                                )}
                            </div>

                            {brushMode && (
                                <>
                                    <div className="lp-settings-row">
                                        <div className="lp-settings-label-row">
                                            <label className="lp-settings-label">Радиус</label>
                                            <span className="lp-settings-val">{Math.round(brushRadius * 100)}%</span>
                                        </div>
                                        <input type="range" className="lp-slider" min="0.01" max="0.2" step="0.01"
                                            value={brushRadius}
                                            onChange={e => setBrushRadius(parseFloat(e.target.value))}
                                        />
                                    </div>
                                    {brushMode === 'add' && (
                                        <div className="lp-settings-row">
                                            <div className="lp-settings-label-row">
                                                <label className="lp-settings-label">Плотность</label>
                                                <span className="lp-settings-val">{brushDensity}</span>
                                            </div>
                                            <input type="range" className="lp-slider" min="1" max="20" step="1"
                                                value={brushDensity}
                                                onChange={e => setBrushDensity(parseInt(e.target.value))}
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="lp-settings-name-row">
                                {editing ? (
                                    <input
                                        className="lp-settings-input"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        autoFocus
                                    />
                                ) : (
                                    <h3 className="lp-loc-name">{selectedLoc.name}</h3>
                                )}
                                <button className="lp-edit-btn" onClick={() => setEditing(!editing)}>
                                    {editing ? "Отмена" : "Изменить"}
                                </button>
                            </div>

                            <div className="lp-settings-row">
                                <div className="lp-settings-label-row">
                                    <label className="lp-settings-label">Вертикальный масштаб</label>
                                    <span className="lp-settings-val">{editScaleZ.toFixed(2)}</span>
                                </div>
                                <input type="range" className="lp-slider" min="0.01" max="2" step="0.01"
                                    value={editScaleZ}
                                    onChange={e => { setEditScaleZ(parseFloat(e.target.value)); setEditing(true); }}
                                />
                            </div>

                            <div className="lp-settings-row">
                                <label className="lp-settings-checkbox">
                                    <input type="checkbox" checked={editWaterEnabled}
                                        onChange={e => { setEditWaterEnabled(e.target.checked); setEditing(true); }} />
                                    Вода
                                </label>
                            </div>

                            {editWaterEnabled && (
                                <div className="lp-settings-row">
                                    <div className="lp-settings-label-row">
                                        <label className="lp-settings-label">Уровень воды</label>
                                        <span className="lp-settings-val">{Math.round(editWaterLevel * 100)}%</span>
                                    </div>
                                    <input type="range" className="lp-slider" min="0" max="1" step="0.01"
                                        value={editWaterLevel}
                                        onChange={e => { setEditWaterLevel(parseFloat(e.target.value)); setEditing(true); }}
                                    />
                                </div>
                            )}

                            <div className="lp-settings-row">
                                <div className="lp-settings-label-row">
                                    <label className="lp-settings-label">Количество деревьев</label>
                                    <span className="lp-settings-val">{editTreeCount}%</span>
                                </div>
                                <input type="range" className="lp-slider" min="0" max="100" step="1"
                                    value={editTreeCount}
                                    onChange={e => { setEditTreeCount(parseInt(e.target.value)); setEditing(true); }}
                                />
                            </div>

                            <div className="lp-settings-divider">Размер деревьев</div>

                            <div className="lp-settings-row">
                                <div className="lp-settings-label-row">
                                    <label className="lp-settings-label">Высота кроны</label>
                                    <span className="lp-settings-val">{editCrownH.toFixed(1)}×</span>
                                </div>
                                <input type="range" className="lp-slider" min="0.2" max="3" step="0.1"
                                    value={editCrownH}
                                    onChange={e => { setEditCrownH(parseFloat(e.target.value)); setEditing(true); }}
                                />
                            </div>

                            <div className="lp-settings-row">
                                <div className="lp-settings-label-row">
                                    <label className="lp-settings-label">Ширина кроны</label>
                                    <span className="lp-settings-val">{editCrownR.toFixed(1)}×</span>
                                </div>
                                <input type="range" className="lp-slider" min="0.2" max="3" step="0.1"
                                    value={editCrownR}
                                    onChange={e => { setEditCrownR(parseFloat(e.target.value)); setEditing(true); }}
                                />
                            </div>

                            <div className="lp-settings-row">
                                <div className="lp-settings-label-row">
                                    <label className="lp-settings-label">Толщина ствола</label>
                                    <span className="lp-settings-val">{editTrunkR.toFixed(1)}×</span>
                                </div>
                                <input type="range" className="lp-slider" min="0.2" max="3" step="0.1"
                                    value={editTrunkR}
                                    onChange={e => { setEditTrunkR(parseFloat(e.target.value)); setEditing(true); }}
                                />
                            </div>

                            {saveMsg && (
                                <p className={`lp-save-msg${saveMsg.startsWith("Ошибка") ? " error" : ""}`}>
                                    {saveMsg}
                                </p>
                            )}

                            <button className="lp-save-btn" disabled={saving} onClick={handleSave}>
                                {saving ? "Сохранение…" : "Сохранить изменения"}
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="lp-empty-viewer">
                        <span>Выберите локацию для предпросмотра</span>
                    </div>
                )}
            </main>
        </div>
    );
};

export default LocationsPage;
