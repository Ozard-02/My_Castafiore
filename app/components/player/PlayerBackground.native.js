import React from 'react'
import { AppState, AccessibilityInfo, PixelRatio, StyleSheet, View } from 'react-native'
import { GLView } from 'expo-gl'

import { hexToRgb, FALLBACK_COLORS, PALETTE_SLOTS } from '~/utils/playerPalette'
import logger from '~/utils/logger'

// Full-screen animated fBM background for the player (spec 2026-10-18).
// Flat color output only: no specular, no bloom, no blur. The palette arrives already
// luminance-clamped for white-text duty (see utils/playerPalette.js) — the shader only
// interpolates and dims.
//
// Tuning lives here (spec "open parameters"):
const TARGET_FPS = 30          // 30-60; slow noise doesn't read 60 and this is pure battery
const FRAME_MS = 1000 / TARGET_FPS
const Z_SPEED = 0.05           // time-axis speed: full palette sweep takes ~20s
const TRANSITION_MS = 450      // palette crossfade on track change
const OCTAVES = 5
const LACUNARITY = 2.0
const GAIN = 0.5
const FREQUENCY = 2.4
const AMP_SUM = 1.0 + GAIN + GAIN * GAIN + GAIN ** 3 + GAIN ** 4 // 5 octaves, keep in sync

// GLSL floats need a decimal point ("2.0", not "2"), so the tuning constants are
// formatted into the shader source. Formatting goes through String() to keep the
// receiver a variable: a JS minifier rewrites GAIN.toFixed(1) as .5.toFixed(1), and
// Hermes mis-lexes that leading-dot form as a call ON the number 0.5. Release Hermes
// builds skip JS minification, so this is insurance — NOT the 2026-10-18 crash fix
// (that was a stray backtick closing the shader template; see the fBM comment below).
const glslFloat = (n) => {
	const s = String(n)
	return s.includes('.') ? s : `${s}.0`
}

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_dim;
uniform vec3 u_palette[6];

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// Ashima / Stefan Gustavson simplex noise (3D, -1..1)
float snoise(vec3 v) {
	const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
	const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

	vec3 i = floor(v + dot(v, C.yyy));
	vec3 x0 = v - i + dot(i, C.xxx);

	vec3 g = step(x0.yzx, x0.xyz);
	vec3 l = 1.0 - g;
	vec3 i1 = min(g.xyz, l.zxy);
	vec3 i2 = max(g.xyz, l.zxy);

	vec3 x1 = x0 - i1 + C.xxx;
	vec3 x2 = x0 - i2 + C.yyy;
	vec3 x3 = x0 - D.yyy;

	i = mod289(i);
	vec4 p = permute(permute(permute(
		i.z + vec4(0.0, i1.z, i2.z, 1.0))
		+ i.y + vec4(0.0, i1.y, i2.y, 1.0))
		+ i.x + vec4(0.0, i1.x, i2.x, 1.0));

	float n_ = 0.142857142857;
	vec3 ns = n_ * D.wyz - D.xzx;

	vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

	vec4 x_ = floor(j * ns.z);
	vec4 y_ = floor(j - 7.0 * x_);

	vec4 x = x_ * ns.x + ns.yyyy;
	vec4 y = y_ * ns.x + ns.yyyy;
	vec4 h = 1.0 - abs(x) - abs(y);

	vec4 b0 = vec4(x.xy, y.xy);
	vec4 b1 = vec4(x.zw, y.zw);

	vec4 s0 = floor(b0) * 2.0 + 1.0;
	vec4 s1 = floor(b1) * 2.0 + 1.0;
	vec4 sh = -step(h, vec4(0.0));

	vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
	vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

	vec3 p0 = vec3(a0.xy, h.x);
	vec3 p1 = vec3(a0.zw, h.y);
	vec3 p2 = vec3(a1.xy, h.z);
	vec3 p3 = vec3(a1.zw, h.w);

	vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
	p0 *= norm.x;
	p1 *= norm.y;
	p2 *= norm.z;
	p3 *= norm.w;

	vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
	m = m * m;
	return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// fBM: ${OCTAVES} octaves, lacunarity ${LACUNARITY}, gain ${GAIN}, normalized to [0,1].
// Normalization matters: a plain * 0.5 + 0.5 leaves the tails outside [0,1], which
// flattens the two extreme bands into solid plateaus. (No backticks in here: the
// shader lives in a template literal, and a stray backtick closes it early.)
float fbm(vec3 p) {
	float sum = 0.0;
	float amp = 1.0;
	float freq = 1.0;
	for (int i = 0; i < ${OCTAVES}; i++) {
		sum += amp * snoise(p * freq);
		freq *= ${glslFloat(LACUNARITY)};
		amp *= ${glslFloat(GAIN)};
	}
	return clamp(sum / ${glslFloat(AMP_SUM)} * 0.5 + 0.5, 0.0, 1.0);
}

// Spec formula color = interpolate(palette[i], palette[i+1], fract(n * (size-1))),
// unrolled over the 6 slots: GLSL ES 1.0 only guarantees constant indices into uniform
// arrays, so the mix chain replaces palette[int(t)].
vec3 paletteColor(float n) {
	float x = n * 5.0;
	vec3 c = u_palette[0];
	c = mix(c, u_palette[1], clamp(x, 0.0, 1.0));
	c = mix(c, u_palette[2], clamp(x - 1.0, 0.0, 1.0));
	c = mix(c, u_palette[3], clamp(x - 2.0, 0.0, 1.0));
	c = mix(c, u_palette[4], clamp(x - 3.0, 0.0, 1.0));
	c = mix(c, u_palette[5], clamp(x - 4.0, 0.0, 1.0));
	return c;
}

void main() {
	vec2 uv = gl_FragCoord.xy / u_resolution;
	uv.x *= u_resolution.x / u_resolution.y;
	float n = fbm(vec3(uv * ${glslFloat(FREQUENCY)}, u_time));
	vec3 color = paletteColor(n);
	color = mix(color, vec3(0.0), u_dim);
	gl_FragColor = vec4(color, 1.0);
}
`

const paletteToFloats = (palette) => {
	const out = new Float32Array(PALETTE_SLOTS * 3)
	const src = Array.isArray(palette) && palette.length ? palette : FALLBACK_COLORS
	for (let i = 0; i < PALETTE_SLOTS; i++) {
		const rgb = hexToRgb(src[Math.min(i, src.length - 1)]) || { r: 0, g: 0, b: 0 }
		out[i * 3] = rgb.r
		out[i * 3 + 1] = rgb.g
		out[i * 3 + 2] = rgb.b
	}
	return out
}

const compile = (gl, type, source) => {
	const shader = gl.createShader(type)
	gl.shaderSource(shader, source)
	gl.compileShader(shader)
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(`shader: ${gl.getShaderInfoLog(shader)}`)
	}
	return shader
}

const PlayerBackground = ({ palette, dim = 0.15 }) => {
	const glRef = React.useRef(null)
	const uniformsRef = React.useRef(null)
	const dimRef = React.useRef(dim)
	dimRef.current = dim
	const paletteRef = React.useRef(palette)
	paletteRef.current = palette
	const reducedRef = React.useRef(false)
	const anim = React.useRef({
		current: null, from: null, target: null, transitionStart: 0,
		time: 0, last: 0, raf: null, running: false, dirty: true,
		bufW: 0, bufH: 0,
	})

	// expo-gl creates the EGL surface ONCE from the surface size at mount time and ignores
	// later size changes (GLView.kt only re-initializes after a 0-size start). If the size
	// it captured doesn't match the view (modal/window in an intermediate or different
	// window mode — e.g. the cover screen — at mount), every frame lands in the wrong
	// buffer: the visible part animates, the rest stays frozen (the "gold band" artifact).
	// Defense: measure the view, remount the GLView until the drawing buffer matches it.
	const [layout, setLayout] = React.useState(null)
	const [remountKey, setRemountKey] = React.useState(0)
	const layoutPxRef = React.useRef(null)
	const remountCountRef = React.useRef(0)
	const remountAtRef = React.useRef(0)
	const onLayout = React.useCallback((e) => {
		const { width, height } = e.nativeEvent.layout
		const pxW = PixelRatio.getPixelSizeForLayoutSize(width)
		const pxH = PixelRatio.getPixelSizeForLayoutSize(height)
		if (pxW <= 0 || pxH <= 0) return
		const prev = layoutPxRef.current
		if (prev && prev.w === pxW && prev.h === pxH) return
		layoutPxRef.current = { w: pxW, h: pxH }
		remountCountRef.current = 0
		remountAtRef.current = Date.now()
		setLayout(`${pxW}x${pxH}`)
	}, [])

	// Track change: crossfade uniforms over TRANSITION_MS instead of cutting.
	React.useEffect(() => {
		const a = anim.current
		const next = paletteToFloats(palette)
		if (!a.current) {
			a.current = next
			a.target = next
			a.dirty = true
			return
		}
		if (reducedRef.current) {
			a.current = next
			a.target = next
			a.from = null
			a.transitionStart = 0
			a.dirty = true
			return
		}
		a.from = a.current.slice()
		a.target = next
		a.transitionStart = Date.now()
	}, [palette])

	// Reduce Motion: freeze the time axis (palette crossfades snap, frame stays static).
	React.useEffect(() => {
		let mounted = true
		AccessibilityInfo.isReduceMotionEnabled()
			.then((value) => {
				if (!mounted) return
				reducedRef.current = value
				anim.current.dirty = true
			})
			.catch(() => { })
		const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
			reducedRef.current = value
			anim.current.dirty = true
		})
		return () => {
			mounted = false
			sub?.remove?.()
		}
	}, [])

	const startLoop = React.useCallback(() => {
		const a = anim.current
		if (a.running) return
		a.running = true
		const render = () => {
			if (!a.running) return
			a.raf = requestAnimationFrame(render)
			const gl = glRef.current
			const u = uniformsRef.current
			if (!gl || !u) return
			const now = Date.now()
			if (a.last && now - a.last < FRAME_MS - 1) return
			const dt = a.last ? Math.min(0.25, (now - a.last) / 1000) : FRAME_MS / 1000
			a.last = now

			let needs = a.dirty
			a.dirty = false
			if (a.transitionStart) {
				const f = Math.min(1, (now - a.transitionStart) / TRANSITION_MS)
				const cur = a.current
				for (let i = 0; i < cur.length; i++) cur[i] = a.from[i] + (a.target[i] - a.from[i]) * f
				if (f >= 1) {
					a.from = null
					a.target = a.current
					a.transitionStart = 0
				}
				needs = true
			}
			if (!reducedRef.current) {
				a.time += dt * Z_SPEED
				needs = true
			}
			const w = gl.drawingBufferWidth
			const h = gl.drawingBufferHeight
			if (w !== a.bufW || h !== a.bufH) {
				a.bufW = w
				a.bufH = h
				gl.viewport(0, 0, w, h)
				gl.uniform2f(u.resolution, w, h)
				needs = true
			}
			// surface doesn't cover the view: see the onLayout comment — remount until it does.
			const exp = layoutPxRef.current
			if (exp && (Math.abs(w - exp.w) > 2 || Math.abs(h - exp.h) > 2)) {
				if (remountCountRef.current < 5 && now - remountAtRef.current > 500) {
					remountCountRef.current += 1
					remountAtRef.current = now
					logger.info('PlayerBackground', `surface ${w}x${h} != view ${exp.w}x${exp.h}, remount #${remountCountRef.current}`)
					setRemountKey((k) => k + 1)
				} else if (remountCountRef.current === 5) {
					remountCountRef.current = 6
					logger.error('PlayerBackground', `surface ${w}x${h} stays != view ${exp.w}x${exp.h}, giving up`)
				}
			}
			if (!needs) return
			gl.uniform1f(u.time, a.time)
			gl.uniform1f(u.dim, dimRef.current)
			gl.uniform3fv(u.palette, a.current)
			gl.drawArrays(gl.TRIANGLES, 0, 3)
			gl.endFrameEXP()
		}
		a.raf = requestAnimationFrame(render)
	}, [])

	const stopLoop = React.useCallback(() => {
		const a = anim.current
		a.running = false
		if (a.raf) cancelAnimationFrame(a.raf)
		a.raf = null
	}, [])

	// Pause entirely when the app is backgrounded; resume on return.
	React.useEffect(() => {
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') startLoop()
			else stopLoop()
		})
		return () => {
			sub.remove()
			stopLoop()
			glRef.current = null
			uniformsRef.current = null
		}
	}, [startLoop, stopLoop])

	const onContextCreate = (gl) => {
		try {
			const program = gl.createProgram()
			gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER))
			gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER))
			gl.linkProgram(program)
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				throw new Error(`link: ${gl.getProgramInfoLog(program)}`)
			}
			gl.useProgram(program)

			const position = gl.getAttribLocation(program, 'position')
			gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
			// one triangle covering the whole clip space
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
			gl.enableVertexAttribArray(position)
			gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

			uniformsRef.current = {
				resolution: gl.getUniformLocation(program, 'u_resolution'),
				time: gl.getUniformLocation(program, 'u_time'),
				dim: gl.getUniformLocation(program, 'u_dim'),
				palette: gl.getUniformLocation(program, 'u_palette'),
			}
			glRef.current = gl

			const a = anim.current
			if (!a.current) {
				a.current = paletteToFloats(paletteRef.current)
				a.target = a.current
			}
			a.bufW = 0
			a.bufH = 0
			a.dirty = true
			const exp0 = layoutPxRef.current
			logger.info('PlayerBackground', `context ${gl.drawingBufferWidth}x${gl.drawingBufferHeight} (view ${exp0?.w}x${exp0?.h})`)
			startLoop()
		} catch (error) {
			logger.error('PlayerBackground', `${error?.message || error}`)
		}
	}

	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
			{layout && (
				<GLView
					key={`${layout}#${remountKey}`}
					style={StyleSheet.absoluteFill}
					msaaSamples={0}
					onContextCreate={onContextCreate}
				/>
			)}
		</View>
	)
}

export default PlayerBackground
