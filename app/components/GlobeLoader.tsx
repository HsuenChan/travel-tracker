"use client";

import { useEffect, useRef, useState } from "react";
import LoginGlobe from "./LoginGlobe";

export default function GlobeLoader() {
  const [GlobeComponent, setGlobeComponent] = useState<any>(null);
  const [globe3dReady, setGlobe3dReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const globeInitRef = useRef(false);

  useEffect(() => {
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
    import("react-globe.gl").then((mod) => setGlobeComponent(() => mod.default));
  }, []);

  const handleRef = (ref: any) => {
    if (!ref || globeInitRef.current) return;
    globeInitRef.current = true;
    ref.controls().autoRotate = true;
    ref.controls().autoRotateSpeed = 1.2;
    ref.controls().enableZoom = false;
    ref.controls().enablePan = false;
    ref.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);
    ref.renderer()?.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Small delay to let textures render before fading in
    setTimeout(() => setGlobe3dReady(true), 400);
  };

  return (
    <div className="relative w-full h-full">
      {/* LoginGlobe fallback — fades out when 3D is ready */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-700"
        style={{ opacity: globe3dReady ? 0 : 1, pointerEvents: "none" }}
      >
        <div className="opacity-80 scale-110 md:scale-125">
          <LoginGlobe />
        </div>
      </div>

      {/* 3D Globe — fades in when ready */}
      {GlobeComponent && dimensions.width > 0 && (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: globe3dReady ? 1 : 0, pointerEvents: "none" }}
        >
          <GlobeComponent
            ref={handleRef}
            width={dimensions.width}
            height={dimensions.height}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          />
        </div>
      )}
    </div>
  );
}
