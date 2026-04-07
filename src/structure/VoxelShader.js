/**
 * VoxelShader.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shader patches for the voxel InstancedMesh.
 *
 * Strategy: inject into MeshStandardMaterial via onBeforeCompile so we keep
 * full PBR lighting, shadow casting, and correct depth/normals for N8AO.
 *
 * The vertex shader derives each cube's world position entirely from
 * gl_InstanceID — no CPU matrix updates at runtime. All 1 000 instanceMatrix
 * values are set to identity once at initialisation and never touched again.
 *
 * FOUR STATES  (uTransition 0 → 3)
 * ──────────────────────────────────
 *  0  Solid Cube         — all voxels at their 10×10×10 grid positions.
 *  1  Exploded / Slivered — each voxel flies along its radial direction, shrunk.
 *  2  Carved Architectural— outer shell + central I-beam cross; interior hidden.
 *  3  Voxel Wave / Step  — staircase mask, sine-wave Y displacement.
 *
 * Transitions are driven by:
 *   t_AB = smoothstep( 0, 1, clamp( uTransition − A, 0, 1 ) )
 * so each segment [A, A+1] has its own smooth ease-in-out.
 *
 * COLOUR LOGIC
 * ────────────
 * Greyscale  — radial gradient: mid-grey (centre) → near-white (edge).
 * HUX Blue   — uniform #201fff throughout.
 * HUX Pink   — uniform #f72e62 throughout.
 * In State 3 the active voxels always pulse blue → pink following the wave crest,
 * regardless of theme.
 */

// ─── Grid constants (shared with Structure.jsx) ───────────────────────────────
export const GRID_SIZE = 10
export const COUNT     = GRID_SIZE ** 3   // 1 000
export const SPACING   = 1.1             // centre-to-centre distance

// ─── Uniform factory ──────────────────────────────────────────────────────────
/**
 * Returns a fresh uniforms object for use in onBeforeCompile.
 * Values are mutable — update them directly from useFrame.
 */
export function createUniforms() {
  return {
    uTime:          { value: 0 },
    uTransition:    { value: 0 },
    uWobbleEnabled: { value: 1.0 },   // float: 1.0 = on, 0.0 = off (avoids bool uniform quirks)
    uWobbleAmp:     { value: 0.4 },
    uTheme:         { value: 0.0 },   // 0 = greyscale, 1 = blue, 2 = pink
  }
}

// ─── Vertex shader injection ───────────────────────────────────────────────────
// Prepended to the vertex shader before void main() — declares uniforms + varyings.
const VERTEX_PREAMBLE = /* glsl */`
  uniform float uTime;
  uniform float uTransition;
  uniform float uWobbleEnabled;
  uniform float uWobbleAmp;
  uniform float uTheme;

  varying vec3  vVoxelColour;
  varying float vVoxelScale;
`

// Replaces Three.js's #include <begin_vertex> (which sets `vec3 transformed`).
// Computes the deformed position and scale from gl_InstanceID + uniforms.
const VERTEX_DEFORMATION = /* glsl */`
  // ── Declare 'transformed' (Three.js standard name) ─────────────────────
  vec3 transformed = vec3( position );

  // ── Derive integer grid coordinates from the instance index ─────────────
  // gl_InstanceID: 0 → GRID_SIZE³ − 1 (WebGL 2 built-in)
  const int GSIZ = ${GRID_SIZE};
  int idx = gl_InstanceID;
  int ix  = idx % GSIZ;
  int iy  = (idx / GSIZ) % GSIZ;
  int iz  = idx / (GSIZ * GSIZ);

  // Centred float coordinates in the range [−4.5, +4.5]
  float fi = float(ix) - ${(GRID_SIZE - 1) / 2}.0;
  float fj = float(iy) - ${(GRID_SIZE - 1) / 2}.0;
  float fk = float(iz) - ${(GRID_SIZE - 1) / 2}.0;

  // ── STATE 0 : Solid 10×10×10 cube ───────────────────────────────────────
  vec3  pos0  = vec3(fi, fj, fk) * ${SPACING};
  float scl0  = 1.0;

  // ── STATE 1 : Exploded / slivered ────────────────────────────────────────
  // Each voxel flies outward along its radial direction from the grid centre.
  // A small scale shrinks each block to a sliver for the disintegrating look.
  vec3  radial = vec3(fi, fj, fk);
  float rLen   = length(radial);
  vec3  expDir = rLen > 0.001 ? normalize(radial) : vec3(0.0, 1.0, 0.0);
  vec3  pos1   = (radial + expDir * 6.5) * ${SPACING};
  float scl1   = 0.22;

  // ── STATE 2 : Carved architectural ──────────────────────────────────────
  // Outer shell (surface voxels) + central I-beam axes visible.
  // Interior voxels are shrunk to near-zero — invisible but not degenerate.
  bool isShell  = ( ix == 0 || ix == GSIZ-1 ||
                    iy == 0 || iy == GSIZ-1 ||
                    iz == 0 || iz == GSIZ-1 );
  bool isCross  = ( ix == 4 || ix == 5 ||
                    iy == 4 || iy == 5 ||
                    iz == 4 || iz == 5 );
  vec3  pos2    = pos0;
  float scl2    = (isShell || isCross) ? 1.0 : 0.004;

  // ── STATE 3 : Voxel wave / staircase ────────────────────────────────────
  // Staircase: only voxels where iy ≤ ix are visible (ascending diagonal).
  // Sine-wave Y displacement creates the rolling "voxel wave" look.
  float waveY = sin(fi * 0.85 + uTime * 1.3) * 1.15;
  vec3  pos3  = vec3(fi * ${SPACING}, fj * ${SPACING} + waveY, fk * ${SPACING});
  float scl3  = float(iy <= ix);   // 1.0 if on staircase, 0.0 if not

  // ── Sequential smooth transitions ────────────────────────────────────────
  // t_AB ∈ [0,1] is the normalised progress within the segment [A, A+1].
  // smoothstep gives an ease-in-out S-curve for each segment.
  float t01 = smoothstep(0.0, 1.0, clamp(uTransition,       0.0, 1.0));
  float t12 = smoothstep(0.0, 1.0, clamp(uTransition - 1.0, 0.0, 1.0));
  float t23 = smoothstep(0.0, 1.0, clamp(uTransition - 2.0, 0.0, 1.0));

  vec3  bPos = pos0;
  bPos = mix(bPos, pos1, t01);
  bPos = mix(bPos, pos2, t12);
  bPos = mix(bPos, pos3, t23);

  float bScl = scl0;
  bScl = mix(bScl, scl1, t01);
  bScl = mix(bScl, scl2, t12);
  bScl = mix(bScl, scl3, t23);

  // ── Wobble overlay (additive Y, toggleable) ───────────────────────────────
  // Two layered sine waves at incommensurable frequencies prevent periodicity.
  float wobble = sin(fi * 1.15 + fk * 0.72 + uTime * 1.65)
               * cos(fk * 0.55 + uTime * 0.92)
               * uWobbleAmp;
  bPos.y += wobble * uWobbleEnabled;

  // ── Apply scale + translation to the geometry vertices ───────────────────
  // 'position' = the unit-box vertex (local space).
  // We scale the box uniformly then translate to the computed world position.
  // instanceMatrix is identity for all instances, so project_vertex's
  //   mvPosition = instanceMatrix * mvPosition  is a no-op.
  transformed = position * bScl + bPos;

  // ── Per-instance colour (computed on GPU, passed to fragment) ────────────
  float normDist = length(radial) / (${(GRID_SIZE - 1) / 2}.0 * 1.7321); // 0=centre, 1=corner

  // State 3 wave-pulse: colour sweeps blue→pink following the wave crest.
  float wave01  = sin(fi * 0.85 + uTime * 1.3) * 0.5 + 0.5;
  vec3  colWave = mix(
    vec3(0.125, 0.122, 1.000),   // #201fff
    vec3(0.969, 0.180, 0.384),   // #f72e62
    wave01
  );

  vec3 baseColour;
  if (uTheme < 0.5) {
    // Greyscale: mid-grey centre → near-white edge
    baseColour = mix(vec3(0.76), vec3(0.97), normDist);
  } else if (uTheme < 1.5) {
    // HUX Blue — uniform but slightly lighter on edges for depth cue
    baseColour = mix(vec3(0.125, 0.122, 1.000), vec3(0.3, 0.28, 1.0), normDist);
  } else {
    // HUX Pink — uniform with edge highlight
    baseColour = mix(vec3(0.969, 0.180, 0.384), vec3(1.0, 0.42, 0.6), normDist);
  }

  // Blend to wave-pulse colour as State 3 is entered
  vVoxelColour = mix(baseColour, colWave, t23);
  vVoxelScale  = bScl;
`

// ─── Fragment shader injection ─────────────────────────────────────────────────
// Prepended to the fragment shader.
const FRAGMENT_PREAMBLE = /* glsl */`
  varying vec3  vVoxelColour;
  varying float vVoxelScale;
`

// Replaces #include <color_fragment> to apply the per-instance colour.
const FRAGMENT_COLOUR = /* glsl */`
  // Discard near-zero-scale voxels (interior carved / off-step voxels).
  // This removes their depth contribution so N8AO is not polluted by
  // invisible geometry writing to the depth buffer.
  if (vVoxelScale < 0.02) discard;

  diffuseColor.rgb *= vVoxelColour;
`

// ─── patchMaterial ────────────────────────────────────────────────────────────
/**
 * Applies the voxel shader patches to a MeshStandardMaterial via onBeforeCompile.
 * Call this once when creating the material — Three.js compiles the program lazily
 * on first render. The returned `uniformsRef` object is populated at compile time;
 * update its values in useFrame.
 *
 * @param {THREE.MeshStandardMaterial} material
 * @param {{ current: object }}        uniformsRef   React ref to store live uniforms
 */
export function patchMaterial(material, uniformsRef) {
  material.onBeforeCompile = (shader) => {
    // Merge custom uniforms into the shader program
    Object.assign(shader.uniforms, createUniforms())
    // Store a live reference so useFrame can mutate values without re-patching
    uniformsRef.current = shader.uniforms

    // ── Vertex shader ───────────────────────────────────────────────────────
    // 1. Prepend varying + uniform declarations
    shader.vertexShader = VERTEX_PREAMBLE + shader.vertexShader

    // 2. Replace the begin_vertex chunk with our deformation
    //    The chunk declares 'vec3 transformed' which our GLSL reuses.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      VERTEX_DEFORMATION,
    )

    // ── Fragment shader ─────────────────────────────────────────────────────
    // 1. Prepend varying declarations
    shader.fragmentShader = FRAGMENT_PREAMBLE + shader.fragmentShader

    // 2. Replace color_fragment with our discard + colour multiply
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      FRAGMENT_COLOUR,
    )
  }

  // Prevent Three.js reusing a cached program that lacks our patches
  material.customProgramCacheKey = () => 'hux-voxel-v1'
}
