import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./TerrainViewer.css";

interface TreeData {
    x: number;
    z: number;
    y: number;
    s: number;
}

interface TreesJson {
    count: number;
    scale_z: number;
    y_up?: boolean;
    trees: TreeData[];
}

interface Props {
    objUrl: string;
    textureUrl: string;
    treesUrl?: string;
}

function addTrees(scene: THREE.Scene, data: TreesJson, box: THREE.Box3, center: THREE.Vector3, size: THREE.Vector3) {
    const trees = data.trees;
    if (!trees || trees.length === 0) return;

    // y_up=true  → OBJ: X=col, Y=height, Z=row
    // y_up=false → OBJ: X=col, Y=row,    Z=height  (default)
    const yUp = data.y_up ?? false;

    // Horizontal extent (OBJ units ≈ image pixels)
    const hSpan = yUp ? Math.max(size.x, size.z) : Math.max(size.x, size.y);

    // Crown radius: ~0.8% of terrain horizontal span → readable dot from above.
    // Crown HEIGHT = 5× radius → conical shape, not a flat disc (ratio ~5:1 like a spruce).
    // Trunk is 30% of crown height.
    const crownR = hSpan * 0.003;
    const crownH = crownR * 5.0;
    const trunkH = crownH * 0.30;
    const trunkR = crownR * 0.15;

    // Exporter convention (see exporter.py save_obj):
    //   y_up=false (Z-up/Blender): x=col, y=H-1-row, z=height  → row is INVERTED
    //   y_up=true  (Y-up/Unity):   x=col, y=height,  z=H-1-row → row is INVERTED
    //
    // ConeGeometry tip is at +Y by default. For Z-up terrain we rotate +90° around X
    // so the tip points in +Z (up). -90° would make it point -Z (down) — inverted cone.
    const upQuat = yUp
        ? new THREE.Quaternion()
        : new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));

    const trunkGeo = new THREE.CylinderGeometry(trunkR, trunkR * 1.1, trunkH, 5);
    const crownGeo = new THREE.ConeGeometry(crownR, crownH, 6);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x2d6e2a });

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    const crownMesh = new THREE.InstancedMesh(crownGeo, crownMat, trees.length);
    trunkMesh.castShadow = false;
    crownMesh.castShadow = false;

    const pos = new THREE.Vector3();
    const sc3 = new THREE.Vector3();
    const mat = new THREE.Matrix4();

    for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        const sc = t.s;

        // t.x = normalized col [0,1], t.z = normalized row [0,1], t.y = normalized height [0,1]
        // Row is inverted in OBJ: OBJ_row_axis = (1 - t.z) * size
        let wx: number, wy: number, wz: number;
        if (yUp) {
            // Y-up: x=col, y=height, z=H-1-row → z maps to (1-t.z)
            wx = box.min.x + t.x        * size.x - center.x;
            wy = box.min.y + t.y        * size.y - center.y;
            wz = box.min.z + (1 - t.z)  * size.z - center.z;
        } else {
            // Z-up: x=col, y=H-1-row → y maps to (1-t.z), z=height
            wx = box.min.x + t.x        * size.x - center.x;
            wy = box.min.y + (1 - t.z)  * size.y - center.y;
            wz = box.min.z + t.y        * size.z - center.z;
        }

        sc3.set(sc, sc, sc);

        // Trunk base on terrain surface, grows in the "up" axis direction
        if (yUp) {
            pos.set(wx, wy + trunkH * 0.5 * sc, wz);
        } else {
            pos.set(wx, wy, wz + trunkH * 0.5 * sc);
        }
        mat.compose(pos, upQuat, sc3);
        trunkMesh.setMatrixAt(i, mat);

        // Crown on top of trunk
        if (yUp) {
            pos.set(wx, wy + (trunkH + crownH * 0.5) * sc, wz);
        } else {
            pos.set(wx, wy, wz + (trunkH + crownH * 0.5) * sc);
        }
        mat.compose(pos, upQuat, sc3);
        crownMesh.setMatrixAt(i, mat);
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    crownMesh.instanceMatrix.needsUpdate = true;

    scene.add(trunkMesh);
    scene.add(crownMesh);
}

export const TerrainViewer = ({ objUrl, textureUrl, treesUrl }: Props) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        setLoading(true);
        setProgress(0);
        setError(null);

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 420;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0d1117);

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100000);

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
        controls.screenSpacePanning = false;

        const texLoader = new THREE.TextureLoader();
        const texture = texLoader.load(textureUrl);
        texture.colorSpace = THREE.SRGBColorSpace;

        const objLoader = new OBJLoader();
        objLoader.load(
            objUrl,
            async (obj) => {
                setProgress(100);
                obj.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
                            map: texture,
                        });
                    }
                });

                const box = new THREE.Box3().setFromObject(obj);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                obj.position.sub(center);
                scene.add(obj);

                if (treesUrl) {
                    try {
                        const resp = await fetch(treesUrl);
                        if (resp.ok) {
                            const data: TreesJson = await resp.json();
                            addTrees(scene, data, box, center, size);
                        }
                    } catch {
                        // trees are optional — silently skip
                    }
                }

                const maxDim = Math.max(size.x, size.y, size.z);
                camera.position.set(0, maxDim * 0.7, maxDim * 1.4);
                camera.lookAt(0, 0, 0);
                controls.target.set(0, 0, 0);
                controls.update();

                setLoading(false);
            },
            (xhr) => {
                if (xhr.total) setProgress(Math.round(xhr.loaded / xhr.total * 90));
            },
            () => {
                setError("Не удалось загрузить 3D модель");
                setLoading(false);
            },
        );

        let frameId: number;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
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
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, [objUrl, textureUrl, treesUrl]);

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
            {error && (
                <div className="terrain-viewer-overlay terrain-viewer-error">
                    {error}
                </div>
            )}
            {!loading && !error && (
                <div className="terrain-viewer-hint">
                    ЛКМ — вращение · Колёсико — масштаб · ПКМ — сдвиг
                </div>
            )}
        </div>
    );
};
