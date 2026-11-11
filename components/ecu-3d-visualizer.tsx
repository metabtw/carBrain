"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  RotateCcw,
  Maximize2,
  Table as TableIcon,
  Box,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";

interface Ecu3DVisualizerProps {
  matrixData?: number[][];
  rawMatrix?: number[][];
  xAxis?: number[];
  yAxis?: number[];
  mapName?: string;
  unit?: string;
  xLabel?: string;
  yLabel?: string;
  liveModOffset?: number; // e.g. +10% turbo from slider
}

export function Ecu3DVisualizer({
  matrixData,
  rawMatrix,
  xAxis,
  yAxis,
  mapName = "Ladedruck Soll (Turbo Boost Target)",
  unit = "mbar",
  xLabel = "Pedal / IQ",
  yLabel = "Motor Devri (RPM)",
  liveModOffset = 0,
}: Ecu3DVisualizerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"3d" | "table">("3d");
  const [hoveredPoint, setHoveredPoint] = useState<{
    r: number;
    c: number;
    val: number;
    rpm: number;
    load: number;
  } | null>(null);

  // Fallback 16x16 matrix if not yet loaded from backend
  const data = matrixData || Array.from({ length: 16 }, (_, r) =>
    Array.from({ length: 16 }, (_, c) => {
      const rpmF = Math.min(1.0, (r * 220 + 1200) / 4500.0);
      const iqF = c / 15.0;
      return Math.round(1000 + 1150 * iqF * rpmF);
    })
  );

  const rows = data.length;
  const cols = data[0]?.length || 16;

  // Apply live modulation offset from dashboard slider
  const modulatedData = data.map((row) =>
    row.map((val) => Math.round(val * (1 + liveModOffset / 100)))
  );

  useEffect(() => {
    if (viewMode !== "3d" || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // dark slate

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(22, 26, 26);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(15, 30, 20);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    fillLight.position.set(-20, 10, -20);
    scene.add(fillLight);

    // 3. Coordinate System & Grid Floor
    const gridHelper = new THREE.GridHelper(20, 16, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // 4. Create 3D Surface Plane Geometry
    const geomWidth = 16;
    const geomHeight = 16;
    const geometry = new THREE.PlaneGeometry(geomWidth, geomHeight, cols - 1, rows - 1);
    geometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane

    // Min and Max values for normalization
    let minVal = Infinity;
    let maxVal = -Infinity;
    modulatedData.forEach((row) => {
      row.forEach((v) => {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      });
    });
    const range = Math.max(1, maxVal - minVal);

    // Displace vertices in Y (height) and assign heat-map vertex colors
    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const colorLow = new THREE.Color(0x2563eb); // Blue
    const colorMid = new THREE.Color(0x10b981); // Emerald Green
    const colorHigh = new THREE.Color(0xf59e0b); // Amber
    const colorPeak = new THREE.Color(0xef4444); // Crimson Red

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const vertexIndex = r * cols + c;
        const val = modulatedData[r][c];
        const norm = (val - minVal) / range; // 0.0 to 1.0

        // Displace height (Y axis in Three.js)
        const heightY = norm * 7.5;
        pos.setY(vertexIndex, heightY);

        // Heatmap color interpolation
        let vertexColor = new THREE.Color();
        if (norm < 0.33) {
          vertexColor.lerpColors(colorLow, colorMid, norm / 0.33);
        } else if (norm < 0.66) {
          vertexColor.lerpColors(colorMid, colorHigh, (norm - 0.33) / 0.33);
        } else {
          vertexColor.lerpColors(colorHigh, colorPeak, (norm - 0.66) / 0.34);
        }

        colors[vertexIndex * 3] = vertexColor.r;
        colors[vertexIndex * 3 + 1] = vertexColor.g;
        colors[vertexIndex * 3 + 2] = vertexColor.b;
      }
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    // Solid Surface Material with Vertex Colors
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    const surfaceMesh = new THREE.Mesh(geometry, material);
    scene.add(surfaceMesh);

    // Wireframe Overlay Grid (ECU calibration grid lines)
    const wireframeGeom = new THREE.WireframeGeometry(geometry);
    const wireframeMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.22,
    });
    const wireframe = new THREE.LineSegments(wireframeGeom, wireframeMat);
    scene.add(wireframe);

    // 5. Interactive Mouse Controls (Rotate, Pan, Zoom)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let spherical = new THREE.Spherical().setFromVector3(camera.position);

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      spherical.theta -= deltaX * 0.008;
      spherical.phi -= deltaY * 0.008;
      spherical.phi = Math.max(0.1, Math.min(Math.PI / 2.05, spherical.phi));

      camera.position.setFromSpherical(spherical);
      camera.lookAt(0, 2.5, 0);

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.radius += e.deltaY * 0.02;
      spherical.radius = Math.max(12, Math.min(60, spherical.radius));
      camera.position.setFromSpherical(spherical);
      camera.lookAt(0, 2.5, 0);
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    domElement.addEventListener("wheel", onWheel, { passive: false });

    // 6. Animation Loop
    let animId: number;
    let autoRotate = 0.0012;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isDragging) {
        spherical.theta += autoRotate;
        camera.position.setFromSpherical(spherical);
        camera.lookAt(0, 2.5, 0);
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [viewMode, modulatedData, rows, cols]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#1d63ed] dark:bg-blue-950/60 dark:text-blue-400">
            <Box className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{mapName}</span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                16x16 3B Yüzey
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              X: {xLabel} • Y: {yLabel} • Z: {unit}
            </p>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          {liveModOffset !== 0 && (
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300">
              Canlı Sapma: {liveModOffset > 0 ? `+${liveModOffset}%` : `${liveModOffset}%`}
            </span>
          )}

          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                viewMode === "3d"
                  ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <Box className="h-3.5 w-3.5" />
              <span>3B Yüzey</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                viewMode === "table"
                  ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Tablo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative min-h-[420px] w-full bg-[#0b1329]">
        {viewMode === "3d" ? (
          <>
            <div
              ref={mountRef}
              className="h-[420px] w-full cursor-grab active:cursor-grabbing"
            />

            {/* 3D Overlay Badges */}
            <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1.5 text-[11px] text-slate-300">
              <div className="flex items-center gap-2 rounded-lg bg-slate-900/80 px-2.5 py-1 backdrop-blur border border-slate-700/60">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Z (Yükseklik): {unit}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-900/80 px-2.5 py-1 backdrop-blur border border-slate-700/60">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>X: {xLabel}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-900/80 px-2.5 py-1 backdrop-blur border border-slate-700/60">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Y: {yLabel}</span>
              </div>
            </div>

            {/* 3D Legend & Interaction Hint */}
            <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-3 text-xs text-slate-400">
              <span className="rounded-lg bg-slate-900/80 px-3 py-1 border border-slate-700/60 backdrop-blur">
                🖱️ Sol Tık: Döndür • Tekerlek: Yakınlaştır
              </span>
            </div>
          </>
        ) : (
          <div className="max-h-[420px] overflow-auto p-4 bg-slate-950 font-mono text-[11px] text-slate-300">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="p-2 text-left">RPM \ IQ</th>
                  {Array.from({ length: cols }).map((_, c) => (
                    <th key={c} className="p-2 font-normal text-sky-400">
                      {xAxis ? xAxis[c] : `C${c + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {modulatedData.map((row, r) => (
                  <tr key={r} className="hover:bg-slate-900/60">
                    <td className="p-2 text-left font-semibold text-emerald-400">
                      {yAxis ? yAxis[r] : `R${r + 1}`}
                    </td>
                    {row.map((val, c) => (
                      <td
                        key={c}
                        className={`p-2 transition-colors ${
                          val > 1800
                            ? "text-rose-400 font-bold bg-rose-950/20"
                            : val > 1400
                            ? "text-amber-300 bg-amber-950/10"
                            : "text-slate-300"
                        }`}
                      >
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

