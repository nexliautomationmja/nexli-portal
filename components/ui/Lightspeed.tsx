'use client';
import { useEffect, useRef, useState } from "react";

const DEFAULT_FRAG = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
uniform float intensity;
uniform float particleCount;
uniform vec3 colorShift;

#define FC gl_FragCoord.xy
#define R  resolution
#define T  time

float rnd(float a) {
  vec2 p = fract(a * vec2(12.9898, 78.233));
  p += dot(p, p*345.);
  return fract(p.x * p.y);
}

vec3 hue(float a) {
  return colorShift * (.6+.6*cos(6.3*(a)+vec3(0,83,21)));
}

vec3 pattern(vec2 uv) {
  vec3 col = vec3(0.);
  for (float i=.0; i<particleCount; i++) {
    float a = rnd(i);
    vec2 n = vec2(a, fract(a*34.56));
    vec2 p = sin(n*(T+7.) + T*.5);
    float d = dot(uv-p, uv-p);
    col += (intensity * .00125)/d * hue(dot(uv,uv) + i*.125 + T);
  }
  return col;
}

void main(void) {
  vec2 uv = (FC - .5 * R) / min(R.x, R.y);
  vec3 col = vec3(0.);
  float s = 2.4;
  float a = atan(uv.x, uv.y);
  float b = length(uv);
  uv = vec2(a * 5. / 6.28318, .05 / tan(b) + T);
  uv = fract(uv) - .5;
  col += pattern(uv * s);
  O = vec4(col, 1.);
}`;

const DEFAULT_VERT = `#version 300 es
precision highp float;
in vec2 position;
void main(){
  gl_Position = vec4(position, 0.0, 1.0);
}`;

interface LightspeedProps {
  speed?: number;
  intensity?: number;
  particleCount?: number;
  colorR?: number;
  colorG?: number;
  colorB?: number;
  quality?: "low" | "medium" | "high";
  className?: string;
}

export function Lightspeed({
  speed = 1,
  intensity = 1,
  particleCount = 20,
  colorR = 1,
  colorG = 1,
  colorB = 1,
  quality = "medium",
  className,
}: LightspeedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const buffersRef = useRef({ vbo: null as WebGLBuffer | null });
  const uniformsRef = useRef({
    time: null as WebGLUniformLocation | null,
    resolution: null as WebGLUniformLocation | null,
    intensity: null as WebGLUniformLocation | null,
    particleCount: null as WebGLUniformLocation | null,
    colorShift: null as WebGLUniformLocation | null,
  });
  const rafRef = useRef(0);
  const lastFrameRef = useRef(0);
  const [webglOk, setWebglOk] = useState(true);

  const qualitySettings = {
    low: { dpr: 0.5, targetFps: 30 },
    medium: { dpr: 1, targetFps: 60 },
    high: { dpr: 1.5, targetFps: 60 },
  };

  const currentQuality = qualitySettings[quality] || qualitySettings.medium;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });

    if (!gl) {
      setWebglOk(false);
      return;
    }

    setWebglOk(true);
    glRef.current = gl;

    const compile = (type: number, src: string): WebGLShader => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Failed to create shader");
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) || "Shader compile error";
        gl.deleteShader(shader);
        throw new Error(info);
      }
      return shader;
    };

    const link = (vs: WebGLShader, fs: WebGLShader): WebGLProgram => {
      const program = gl.createProgram();
      if (!program) throw new Error("Failed to create program");
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program) || "Program link error";
        gl.deleteProgram(program);
        throw new Error(info);
      }
      return program;
    };

    let vertexShader: WebGLShader | null = null;
    let fragmentShader: WebGLShader | null = null;
    let program: WebGLProgram | null = null;

    try {
      vertexShader = compile(gl.VERTEX_SHADER, DEFAULT_VERT);
      fragmentShader = compile(gl.FRAGMENT_SHADER, DEFAULT_FRAG);
      program = link(vertexShader, fragmentShader);
    } catch {
      setWebglOk(false);
      return;
    }

    programRef.current = program;
    gl.useProgram(program);

    const vbo = gl.createBuffer();
    buffersRef.current.vbo = vbo;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const vertices = new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    uniformsRef.current.time = gl.getUniformLocation(program, "time");
    uniformsRef.current.resolution = gl.getUniformLocation(program, "resolution");
    uniformsRef.current.intensity = gl.getUniformLocation(program, "intensity");
    uniformsRef.current.particleCount = gl.getUniformLocation(program, "particleCount");
    uniformsRef.current.colorShift = gl.getUniformLocation(program, "colorShift");

    const resize = () => {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, currentQuality.dpr));
      const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const cssHeight = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniformsRef.current.resolution, canvas.width, canvas.height);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener("resize", resize);
    resize();

    const startTime = performance.now();
    const loop = (timestamp: number) => {
      rafRef.current = requestAnimationFrame(loop);

      const delta = timestamp - lastFrameRef.current;
      const targetFrameTime = 1000 / currentQuality.targetFps;
      if (delta < targetFrameTime) return;
      lastFrameRef.current = timestamp - (delta % targetFrameTime);

      const now = (timestamp - startTime) * 0.001 * (speed || 1);

      gl.useProgram(programRef.current);
      gl.uniform1f(uniformsRef.current.time, now);
      gl.uniform1f(uniformsRef.current.intensity, intensity);
      gl.uniform1f(uniformsRef.current.particleCount, particleCount);
      gl.uniform3f(uniformsRef.current.colorShift, colorR, colorG, colorB);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);

      if (gl && programRef.current) {
        const attachedShaders = gl.getAttachedShaders(programRef.current) || [];
        attachedShaders.forEach((shader) => gl.deleteShader(shader));
        gl.deleteProgram(programRef.current);
      }

      if (gl && buffersRef.current.vbo) {
        gl.deleteBuffer(buffersRef.current.vbo);
      }
    };
  }, [speed, intensity, particleCount, colorR, colorG, colorB, quality, currentQuality.dpr, currentQuality.targetFps]);

  if (!webglOk) {
    return (
      <div
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#000",
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}
