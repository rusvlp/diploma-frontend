import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./TerrainViewer.css";

interface TreeData { x: number; z: number; y: number; s: number; }
interface TreesJson { count: number; scale_z: number; y_up?: boolean; trees: TreeData[]; }

export interface BrushTree { wx: number; wy: number; wz: number; s: number; }
export interface RemovedZone { x: number; z: number; r: number; }

export interface TerrainViewerHandle {
    getManualState: () => { added: BrushTree[]; removed: RemovedZone[] };
    clearManualTrees: () => void;
}

interface Props {
    objUrl: string;
    textureUrl: string;
    treesUrl?: string;
    scaleZ?: number;
    waterEnabled?: boolean;
    waterLevel?: number;
    visibleTreeFraction?: number;
    crownHeightScale?: number;
    crownRadiusScale?: number;
    trunkRadiusScale?: number;
    brushMode?: 'add' | 'erase' | null;
    brushRadius?: number;
    brushDensity?: number;
    savedExtraTrees?: BrushTree[];
    savedRemovedZones?: RemovedZone[];
}

const MAX_MANUAL_TREES = 5000;

function inRemovedZone(tx: number, tz: number, zones: RemovedZone[]): boolean {
    for (const z of zones) {
        const dx = tx - z.x, dz = tz - z.z;
        if (dx * dx + dz * dz < z.r * z.r) return true;
    }
    return false;
}

function placeTrees(
    trees: TreeData[],
    visCount: number,
    yUp: boolean,
    box: THREE.Box3,
    size: THREE.Vector3,
    center: THREE.Vector3,
    ratio: number,
    trunkMesh: THREE.InstancedMesh,
    crownMesh: THREE.InstancedMesh,
    crownHeightScale: number,
    crownRadiusScale: number,
    trunkRadiusScale: number,
) {
    const hSpan = yUp ? Math.max(size.x, size.z) : Math.max(size.x, size.y);

    const baseCrownR = hSpan * 0.003;
    const baseCrownH = baseCrownR * 5.0;
    const baseTrunkH = baseCrownH * 0.30;
    const baseTrunkR = baseCrownR * 0.15;

    const crownR = baseCrownR * crownRadiusScale;
    const crownH = baseCrownH * crownHeightScale;
    const trunkH = baseTrunkH;
    const trunkR = baseTrunkR * trunkRadiusScale;

    const upQuat = yUp
        ? new THREE.Quaternion()
        : new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));

    const pos     = new THREE.Vector3();
    const scTrunk = new THREE.Vector3();
    const scCrown = new THREE.Vector3();
    const mat     = new THREE.Matrix4();

    const visible = Math.min(visCount, trees.length);
    trunkMesh.count = visible;
    crownMesh.count = visible;

    const step = trees.length / Math.max(visible, 1);

    for (let i = 0; i < visible; i++) {
        const t  = trees[Math.floor(i * step)];
        const sc = t.s;

        let wx: number, wy: number, wz: number;
        if (yUp) {
            wx = box.min.x + t.x * size.x - center.x;
            wy = (box.min.y + t.y * size.y) * ratio - center.y;
            wz = box.min.z + (1 - t.z) * size.z - center.z;
        } else {
            wx = box.min.x + t.x * size.x - center.x;
            wy = box.min.y + (1 - t.z) * size.y - center.y;
            wz = (box.min.z + t.y * size.z) * ratio - center.z;
        }

        scTrunk.set(trunkR * sc, trunkH * sc, trunkR * sc);
        scCrown.set(crownR * sc, crownH * sc, crownR * sc);

        if (yUp) {
            pos.set(wx, wy + trunkH * sc * 0.5, wz);
            mat.compose(pos, upQuat, scTrunk);
            trunkMesh.setMatrixAt(i, mat);
            pos.set(wx, wy + trunkH * sc + crownH * sc * 0.5, wz);
            mat.compose(pos, upQuat, scCrown);
            crownMesh.setMatrixAt(i, mat);
        } else {
            pos.set(wx, wy, wz + trunkH * sc * 0.5);
            mat.compose(pos, upQuat, scTrunk);
            trunkMesh.setMatrixAt(i, mat);
            pos.set(wx, wy, wz + trunkH * sc + crownH * sc * 0.5);
            mat.compose(pos, upQuat, scCrown);
            crownMesh.setMatrixAt(i, mat);
        }
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    crownMesh.instanceMatrix.needsUpdate = true;
}

export const TerrainViewer = forwardRef<TerrainViewerHandle, Props>(({
    objUrl,
    textureUrl,
    treesUrl,
    scaleZ,
    waterEnabled = false,
    waterLevel = 0.1,
    visibleTreeFraction = 1,
    crownHeightScale = 1,
    crownRadiusScale = 1,
    trunkRadiusScale = 1,
    brushMode = null,
    brushRadius = 0.05,
    brushDensity = 3,
    savedExtraTrees,
    savedRemovedZones,
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [sceneReady, setSceneReady] = useState(false);

    const terrainRef   = useRef<THREE.Object3D | null>(null);
    const waterRef     = useRef<THREE.Mesh | null>(null);
    const trunkMeshRef = useRef<THREE.InstancedMesh | null>(null);
    const crownMeshRef = useRef<THREE.InstancedMesh | null>(null);
    const sceneRef     = useRef<THREE.Scene | null>(null);
    const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef  = useRef<OrbitControls | null>(null);

    const manualTrunkRef = useRef<THREE.InstancedMesh | null>(null);
    const manualCrownRef = useRef<THREE.InstancedMesh | null>(null);
    const manualCountRef = useRef(0);

    // Brush state
    const manualTreesRef  = useRef<BrushTree[]>([]);
    const removedZonesRef = useRef<RemovedZone[]>([]);

    const treesDataRef     = useRef<TreeData[]>([]);
    const boxRef           = useRef<THREE.Box3>(new THREE.Box3());
    const boxSizeRef       = useRef<THREE.Vector3>(new THREE.Vector3());
    const boxCenterRef     = useRef<THREE.Vector3>(new THREE.Vector3());
    const originalScaleRef = useRef<number>(0.3);
    const yUpRef           = useRef<boolean>(false);

    // Latest prop values for brush operations
    const crownHScaleRef  = useRef(crownHeightScale);
    const crownRScaleRef  = useRef(crownRadiusScale);
    const trunkRScaleRef  = useRef(trunkRadiusScale);
    const brushRadiusRef  = useRef(brushRadius);
    const brushDensityRef = useRef(brushDensity);
    useEffect(() => { crownHScaleRef.current  = crownHeightScale; }, [crownHeightScale]);
    useEffect(() => { crownRScaleRef.current  = crownRadiusScale; }, [crownRadiusScale]);
    useEffect(() => { trunkRScaleRef.current  = trunkRadiusScale; }, [trunkRadiusScale]);
    useEffect(() => { brushRadiusRef.current  = brushRadius;      }, [brushRadius]);
    useEffect(() => { brushDensityRef.current = brushDensity;     }, [brushDensity]);

    // Function refs — updated every render so they always close over latest values
    const redrawAutoTreesRef      = useRef<() => void>();
    const placeManualTreeInMeshRef = useRef<(wx: number, wy: number, wz: number, s: number) => void>();
    const placeManualTreeRef      = useRef<(wx: number, wy: number, wz: number) => void>();
    const eraseAtPointRef         = useRef<(pt: THREE.Vector3) => void>();

    redrawAutoTreesRef.current = () => {
        const trunk = trunkMeshRef.current;
        const crown = crownMeshRef.current;
        const trees = treesDataRef.current;
        if (!trunk || !crown || !originalScaleRef.current || trees.length === 0) return;

        const yUp     = yUpRef.current;
        const box     = boxRef.current;
        const size    = boxSizeRef.current;
        const center  = boxCenterRef.current;
        const ratio   = (scaleZ ?? originalScaleRef.current) / originalScaleRef.current;
        const fraction = Math.max(0, Math.min(1, visibleTreeFraction ?? 1));

        const zones    = removedZonesRef.current;
        const filtered = zones.length > 0
            ? trees.filter(t => !inRemovedZone(t.x, t.z, zones))
            : trees;

        placeTrees(filtered, Math.round(filtered.length * fraction), yUp, box, size, center, ratio,
            trunk, crown, crownHeightScale, crownRadiusScale, trunkRadiusScale);
    };

    placeManualTreeInMeshRef.current = (wx, wy, wz, s) => {
        const trunk = manualTrunkRef.current;
        const crown = manualCrownRef.current;
        if (!trunk || !crown || manualCountRef.current >= MAX_MANUAL_TREES) return;

        const i = manualCountRef.current++;
        trunk.count = manualCountRef.current;
        crown.count = manualCountRef.current;

        const size  = boxSizeRef.current;
        const yUp   = yUpRef.current;
        const hSpan = yUp ? Math.max(size.x, size.z) : Math.max(size.x, size.y);
        if (hSpan === 0) return;

        const baseCrownR = hSpan * 0.003;
        const baseCrownH = baseCrownR * 5.0;
        const baseTrunkH = baseCrownH * 0.30;
        const baseTrunkR = baseCrownR * 0.15;

        const crownH = baseCrownH * crownHScaleRef.current;
        const crownR = baseCrownR * crownRScaleRef.current;
        const trunkH = baseTrunkH;
        const trunkR = baseTrunkR * trunkRScaleRef.current;

        const upQuat = yUp
            ? new THREE.Quaternion()
            : new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
        const pos = new THREE.Vector3();
        const mat = new THREE.Matrix4();

        if (yUp) {
            mat.compose(pos.set(wx, wy + trunkH * s * 0.5, wz), upQuat, new THREE.Vector3(trunkR * s, trunkH * s, trunkR * s));
            trunk.setMatrixAt(i, mat);
            mat.compose(pos.set(wx, wy + trunkH * s + crownH * s * 0.5, wz), upQuat, new THREE.Vector3(crownR * s, crownH * s, crownR * s));
            crown.setMatrixAt(i, mat);
        } else {
            mat.compose(pos.set(wx, wy, wz + trunkH * s * 0.5), upQuat, new THREE.Vector3(trunkR * s, trunkH * s, trunkR * s));
            trunk.setMatrixAt(i, mat);
            mat.compose(pos.set(wx, wy, wz + trunkH * s + crownH * s * 0.5), upQuat, new THREE.Vector3(crownR * s, crownH * s, crownR * s));
            crown.setMatrixAt(i, mat);
        }

        trunk.instanceMatrix.needsUpdate = true;
        crown.instanceMatrix.needsUpdate = true;
    };

    placeManualTreeRef.current = (wx, wy, wz) => {
        const s = 0.8 + Math.random() * 0.6;
        placeManualTreeInMeshRef.current?.(wx, wy, wz, s);
        manualTreesRef.current.push({ wx, wy, wz, s });
    };

    eraseAtPointRef.current = (pt: THREE.Vector3) => {
        const yUp   = yUpRef.current;
        const box   = boxRef.current;
        const size  = boxSizeRef.current;
        const center = boxCenterRef.current;
        const hSpan = yUp ? Math.max(size.x, size.z) : Math.max(size.x, size.y);
        if (hSpan === 0) return;

        const br     = brushRadiusRef.current;
        const worldR = br * hSpan;

        // Remove manual trees in world-space circle (XZ plane)
        const before = manualTreesRef.current.length;
        manualTreesRef.current = manualTreesRef.current.filter(t => {
            const dx = t.wx - pt.x, dz = t.wz - pt.z;
            return dx * dx + dz * dz >= worldR * worldR;
        });

        if (manualTreesRef.current.length < before) {
            const trunk = manualTrunkRef.current;
            const crown = manualCrownRef.current;
            if (trunk && crown) {
                trunk.count = 0; crown.count = 0; manualCountRef.current = 0;
                trunk.instanceMatrix.needsUpdate = true;
                crown.instanceMatrix.needsUpdate = true;
                for (const tree of manualTreesRef.current) {
                    placeManualTreeInMeshRef.current?.(tree.wx, tree.wy, tree.wz, tree.s);
                }
            }
        }

        // Normalized hit coords (matching t.x / t.z convention in placeTrees)
        let nx: number, nz: number;
        if (yUp) {
            nx = (pt.x + center.x - box.min.x) / size.x;
            nz = 1 - (pt.z + center.z - box.min.z) / size.z;
        } else {
            nx = (pt.x + center.x - box.min.x) / size.x;
            nz = 1 - (pt.y + center.y - box.min.y) / size.y;
        }

        removedZonesRef.current.push({ x: nx, z: nz, r: br });
        redrawAutoTreesRef.current?.();
    };

    useImperativeHandle(ref, () => ({
        getManualState() {
            return {
                added:   [...manualTreesRef.current],
                removed: [...removedZonesRef.current],
            };
        },
        clearManualTrees() {
            const trunk = manualTrunkRef.current;
            const crown = manualCrownRef.current;
            if (trunk) { trunk.count = 0; trunk.instanceMatrix.needsUpdate = true; }
            if (crown) { crown.count = 0; crown.instanceMatrix.needsUpdate = true; }
            manualCountRef.current   = 0;
            manualTreesRef.current   = [];
            removedZonesRef.current  = [];
            redrawAutoTreesRef.current?.();
        },
    }));

    // ── SCENE LOAD ──────────────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        setLoading(true);
        setProgress(0);
        setError(null);
        setSceneReady(false);

        terrainRef.current   = null;
        waterRef.current     = null;
        trunkMeshRef.current = null;
        crownMeshRef.current = null;
        treesDataRef.current = [];
        sceneRef.current     = null;
        cameraRef.current    = null;
        controlsRef.current  = null;
        manualTrunkRef.current = null;
        manualCrownRef.current = null;
        manualCountRef.current = 0;
        manualTreesRef.current = [];
        removedZonesRef.current = [];

        const width  = container.clientWidth  || 800;
        const height = container.clientHeight || 420;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0d1117);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100000);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const sun = new THREE.DirectionalLight(0xfff0cc, 0.9);
        sun.position.set(1, 2, 1.5);
        scene.add(sun);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.07;
        controlsRef.current = controls;

        const mTrunkGeo = new THREE.CylinderGeometry(1, 1.1, 1, 5);
        const mCrownGeo = new THREE.ConeGeometry(1, 1, 6);
        const mTrunk = new THREE.InstancedMesh(mTrunkGeo, new THREE.MeshStandardMaterial({ color: 0x6b3a2a }), MAX_MANUAL_TREES);
        const mCrown = new THREE.InstancedMesh(mCrownGeo, new THREE.MeshStandardMaterial({ color: 0x2d6e2a }), MAX_MANUAL_TREES);
        mTrunk.count = 0; mCrown.count = 0;
        scene.add(mTrunk); scene.add(mCrown);
        manualTrunkRef.current = mTrunk;
        manualCrownRef.current = mCrown;

        const texture = new THREE.TextureLoader().load(textureUrl);
        texture.colorSpace = THREE.SRGBColorSpace;

        const objLoader = new OBJLoader();
        objLoader.load(
            objUrl,
            async (obj) => {
                setProgress(100);
                obj.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ map: texture });
                    }
                });

                const box    = new THREE.Box3().setFromObject(obj);
                const center = box.getCenter(new THREE.Vector3());
                const size   = box.getSize(new THREE.Vector3());

                obj.position.sub(center);
                scene.add(obj);
                terrainRef.current = obj;

                boxRef.current       = box;
                boxSizeRef.current   = size;
                boxCenterRef.current = center;

                if (treesUrl) {
                    try {
                        const resp = await fetch(treesUrl);
                        if (resp.ok) {
                            const data: TreesJson = await resp.json();
                            const origScaleZ = data.scale_z ?? 0.3;
                            const yUp        = data.y_up ?? false;
                            originalScaleRef.current = origScaleZ;
                            yUpRef.current           = yUp;
                            treesDataRef.current     = data.trees ?? [];

                            const count    = data.trees.length;
                            const trunkGeo = new THREE.CylinderGeometry(1, 1.1, 1, 5);
                            const crownGeo = new THREE.ConeGeometry(1, 1, 6);
                            const trunk    = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6b3a2a }), count);
                            const crown    = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0x2d6e2a }), count);
                            trunk.castShadow = false;
                            crown.castShadow = false;
                            scene.add(trunk); scene.add(crown);
                            trunkMeshRef.current = trunk;
                            crownMeshRef.current = crown;

                            const ratio    = (scaleZ ?? origScaleZ) / origScaleZ;
                            const fraction = Math.max(0, Math.min(1, visibleTreeFraction ?? 1));
                            placeTrees(data.trees, Math.round(count * fraction), yUp, box, size, center, ratio, trunk, crown, crownHeightScale, crownRadiusScale, trunkRadiusScale);
                        }
                    } catch { /* trees optional */ }
                }

                const maxDim = Math.max(size.x, size.y, size.z);
                camera.position.set(0, maxDim * 0.7, maxDim * 1.4);
                camera.lookAt(0, 0, 0);
                controls.target.set(0, 0, 0);
                controls.update();
                setSceneReady(true);
                setLoading(false);
            },
            (xhr) => { if (xhr.total) setProgress(Math.round(xhr.loaded / xhr.total * 90)); },
            ()    => { setError("Не удалось загрузить 3D модель"); setLoading(false); },
        );

        let frameId: number;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
            const w = container.clientWidth, h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener("resize", onResize);
            controls.dispose();
            texture.dispose();
            renderer.dispose();
            mTrunkGeo.dispose();
            mCrownGeo.dispose();
            cameraRef.current      = null;
            controlsRef.current    = null;
            manualTrunkRef.current = null;
            manualCrownRef.current = null;
            manualCountRef.current = 0;
            sceneRef.current       = null;
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
    }, [objUrl, textureUrl, treesUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── REACTIVE: scaleZ + water + trees ────────────────────────────────────
    useEffect(() => {
        const terrain = terrainRef.current;
        const scene   = sceneRef.current;
        if (!terrain || !scene || !originalScaleRef.current) return;

        const origScaleZ = originalScaleRef.current;
        const ratio      = (scaleZ ?? origScaleZ) / origScaleZ;
        const yUp        = yUpRef.current;

        if (yUp) terrain.scale.y = ratio;
        else     terrain.scale.z = ratio;

        redrawAutoTreesRef.current?.();

        if (waterRef.current) {
            scene.remove(waterRef.current);
            waterRef.current.geometry.dispose();
            (waterRef.current.material as THREE.Material).dispose();
            waterRef.current = null;
        }

        const box    = boxRef.current;
        const size   = boxSizeRef.current;
        const center = boxCenterRef.current;

        if (waterEnabled && size.x > 0) {
            const level = Math.max(0, Math.min(1, waterLevel ?? 0.1));
            let wGeo: THREE.PlaneGeometry;
            let wMesh: THREE.Mesh;

            if (yUp) {
                const wy = (box.min.y + level * size.y) * ratio - center.y;
                wGeo  = new THREE.PlaneGeometry(size.x * 1.05, size.z * 1.05);
                wMesh = new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial({
                    color: 0x1a6fa8, transparent: true, opacity: 0.70,
                    roughness: 0.08, metalness: 0.04,
                }));
                wMesh.rotation.x = -Math.PI / 2;
                wMesh.position.set(0, wy, 0);
            } else {
                const wz = (box.min.z + level * size.z) * ratio - center.z;
                wGeo  = new THREE.PlaneGeometry(size.x * 1.05, size.y * 1.05);
                wMesh = new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial({
                    color: 0x1a6fa8, transparent: true, opacity: 0.70,
                    roughness: 0.08, metalness: 0.04,
                }));
                wMesh.position.set(0, 0, wz);
            }

            scene.add(wMesh);
            waterRef.current = wMesh;
        }
    }, [scaleZ, waterEnabled, waterLevel, visibleTreeFraction, crownHeightScale, crownRadiusScale, trunkRadiusScale, sceneReady]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── LOAD SAVED BRUSH STATE ───────────────────────────────────────────────
    useEffect(() => {
        if (!sceneReady) return;

        removedZonesRef.current = savedRemovedZones ? [...savedRemovedZones] : [];
        redrawAutoTreesRef.current?.();

        // Reset and re-populate manual trees
        const trunk = manualTrunkRef.current;
        const crown = manualCrownRef.current;
        if (trunk) { trunk.count = 0; trunk.instanceMatrix.needsUpdate = true; }
        if (crown) { crown.count = 0; crown.instanceMatrix.needsUpdate = true; }
        manualCountRef.current = 0;
        manualTreesRef.current = [];

        if (savedExtraTrees && savedExtraTrees.length > 0) {
            for (const tree of savedExtraTrees) {
                placeManualTreeInMeshRef.current?.(tree.wx, tree.wy, tree.wz, tree.s);
                manualTreesRef.current.push({ ...tree });
            }
        }
    }, [sceneReady, savedExtraTrees, savedRemovedZones]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── BRUSH EFFECT ─────────────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        const controls  = controlsRef.current;
        if (!container || !sceneReady) return;

        if (!brushMode) {
            if (controls) controls.enabled = true;
            container.style.cursor = "";
            return;
        }

        if (controls) controls.enabled = false;
        container.style.cursor = brushMode === 'erase' ? "cell" : "crosshair";

        const raycaster = new THREE.Raycaster();
        let painting = false;
        let lastTime = 0;

        const getHit = (e: MouseEvent): THREE.Vector3 | null => {
            const terrain = terrainRef.current;
            const camera  = cameraRef.current;
            if (!terrain || !camera) return null;
            const rect = container.getBoundingClientRect();
            const nx = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
            const ny = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
            raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
            const hits = raycaster.intersectObject(terrain, true);
            return hits.length > 0 ? hits[0].point.clone() : null;
        };

        const paint = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastTime < 120) return;
            lastTime = now;
            const pt = getHit(e);
            if (!pt) return;

            if (brushMode === 'add') {
                const density = brushDensityRef.current;
                const size    = boxSizeRef.current;
                const yUp     = yUpRef.current;
                const hSpan   = yUp ? Math.max(size.x, size.z) : Math.max(size.x, size.y);
                const worldR  = brushRadiusRef.current * hSpan;
                for (let i = 0; i < density; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r     = Math.sqrt(Math.random()) * worldR;
                    placeManualTreeRef.current?.(pt.x + Math.cos(angle) * r, pt.y, pt.z + Math.sin(angle) * r);
                }
            } else {
                eraseAtPointRef.current?.(pt);
            }
        };

        const onDown = (e: MouseEvent) => { if (e.button === 0) { painting = true; paint(e); } };
        const onMove = (e: MouseEvent) => { if (painting) paint(e); };
        const onUp   = () => { painting = false; };

        container.addEventListener("mousedown", onDown);
        container.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);

        return () => {
            container.removeEventListener("mousedown", onDown);
            container.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            if (controlsRef.current) controlsRef.current.enabled = true;
            container.style.cursor = "";
        };
    }, [brushMode, sceneReady]);

    const hintText = brushMode === 'add'
        ? "ЛКМ — рисовать деревья · выключите кисть для вращения"
        : brushMode === 'erase'
            ? "ЛКМ — стирать деревья · выключите кисть для вращения"
            : "ЛКМ — вращение · Колёсико — масштаб · ПКМ — сдвиг";

    return (
        <div className="terrain-viewer">
            <div ref={containerRef} className="terrain-viewer-canvas" />
            {loading && (
                <div className="terrain-viewer-overlay">
                    <span className="terrain-viewer-spinner" />
                    <span>{progress > 0 ? `Загрузка… ${progress}%` : "Загрузка 3D модели…"}</span>
                    {progress > 0 && (
                        <div className="terrain-viewer-progress">
                            <div className="terrain-viewer-progress-bar" style={{ width: `${progress}%` }} />
                        </div>
                    )}
                </div>
            )}
            {error && <div className="terrain-viewer-overlay terrain-viewer-error">{error}</div>}
            {!loading && !error && (
                <div className="terrain-viewer-hint">{hintText}</div>
            )}
        </div>
    );
});

TerrainViewer.displayName = "TerrainViewer";
