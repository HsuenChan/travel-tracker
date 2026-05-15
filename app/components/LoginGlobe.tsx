"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";

import { Feature, FeatureCollection, Geometry } from "geojson";

interface LoginGlobeProps {
  className?: string;
  size?: number;
}

export default function LoginGlobe({ className, size: sizeProp }: LoginGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const landPathRef = useRef<SVGPathElement>(null);
  const gratPathRef = useRef<SVGPathElement>(null);
  const [topoData, setTopoData] = useState<Feature<Geometry> | FeatureCollection<Geometry> | null>(null);

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json")
      .then((r) => r.json())
      .then((data) => {
        setTopoData(topojson.feature(data, data.objects.land));
      });
  }, []);

  useEffect(() => {
    if (!topoData) return;

    const projection = d3.geoOrthographic()
      .scale(88)
      .translate([0, 0])
      .clipAngle(90);

    const path = d3.geoPath(projection);
    const graticule = d3.geoGraticule10();

    let lambda = 0;
    const speed = 40; // degrees per second
    let last = performance.now();
    let rafId: number;

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      lambda = (lambda + speed * dt) % 360;
      projection.rotate([lambda, -18, 0]);

      if (landPathRef.current) {
        landPathRef.current.setAttribute("d", path(topoData) || "");
      }
      if (gratPathRef.current) {
        gratPathRef.current.setAttribute("d", path(graticule) || "");
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [topoData]);

  const SIZE = sizeProp ?? 340;

  return (
    <div ref={containerRef} className={`relative flex items-center justify-center pointer-events-none ${className}`} style={{ width: SIZE, height: SIZE }}>
      {/* Dynamic CSS for animations */}
      <style>{`
        @keyframes spinCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spinCCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        .login-whirl {
          position: absolute;
          inset: 0;
          transform-origin: center;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .login-whirl-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .login-whirl.a { animation: spinCW 12s linear infinite; }
        .login-whirl.b { animation: spinCCW 18s linear infinite; }
        .login-whirl.c { animation: spinCW 25s linear infinite; }
      `}</style>

      {/* Whirl layers */}
      <div className="login-whirl a">
        <svg className="login-whirl-svg" viewBox="-120 -120 240 240">
          <path d="M 0,-92 A 92,92 0 0 1 75.8,-52" fill="none" stroke="#8b5cf6" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M -82,-42 A 92,92 0 0 1 -52,-75.8" fill="none" stroke="#6366f1" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="0.1 6" />
          <circle r="96" fill="none" stroke="#2dd4bf" strokeWidth="0.8" strokeDasharray="1 9" strokeOpacity="0.4" />
        </svg>
      </div>

      <div className="login-whirl b">
        <svg className="login-whirl-svg" viewBox="-120 -120 240 240">
          <path d="M 88,18 A 89.8,89.8 0 0 1 52,73" fill="none" stroke="#a78bfa" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.8" />
          <path d="M -74,-52 A 89.8,89.8 0 0 1 -36,-82" fill="none" stroke="#818cf8" strokeWidth="1" strokeLinecap="round" strokeDasharray="0.1 5" strokeOpacity="0.8" />
          <circle r="104" fill="none" stroke="#2dd4bf" strokeWidth="0.6" strokeDasharray="0.1 7" strokeOpacity="0.3" />
        </svg>
      </div>

      <div className="login-whirl c">
        <svg className="login-whirl-svg" viewBox="-120 -120 240 240">
          <path d="M -112,0 A 112,112 0 0 1 -80,-78" fill="none" stroke="#6366f1" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.6" />
          <path d="M 108,-20 A 112,112 0 0 1 78,60" fill="none" stroke="#8b5cf6" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="0.1 8" strokeOpacity="0.6" />
          <circle r="114" fill="none" stroke="#2dd4bf" strokeWidth="0.5" strokeDasharray="0.1 11" strokeOpacity="0.2" />
        </svg>
      </div>

      {/* Main Globe */}
      <svg id="globe" viewBox="-100 -100 200 200" width="65%" height="65%" className="relative z-10" aria-label="Spinning globe">
        <defs>
          <clipPath id="sphereClip">
            <circle r="88" cx="0" cy="0" />
          </clipPath>
          <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="transparent" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
          </radialGradient>
        </defs>
        <g clipPath="url(#sphereClip)">
          {/* Inner sphere background */}
          <circle r="88" cx="0" cy="0" fill="#09090b" />
          {/* Graticule */}
          <path
            ref={gratPathRef}
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.4"
            strokeOpacity="0.15"
          />
          {/* Land */}
          <path
            ref={landPathRef}
            fill="#a78bfa"
            fillOpacity="0.85"
            stroke="none"
            style={{ filter: 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.5))' }}
          />
          {/* Glow effect overlay */}
          <circle r="88" cx="0" cy="0" fill="url(#globeGlow)" pointerEvents="none" />
        </g>
        {/* Sphere border */}
        <circle
          r="88"
          cx="0"
          cy="0"
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
      </svg>
    </div>
  );
}
