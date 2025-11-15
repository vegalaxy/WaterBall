struct RenderUniforms {
    texel_size: vec2f,
    sphere_size: f32,
    inv_projection_matrix: mat4x4f,
    projection_matrix: mat4x4f,
    view_matrix: mat4x4f,
    inv_view_matrix: mat4x4f,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) worldPos: vec3f,
    @location(1) normal: vec3f,
    @location(2) viewPos: vec3f,
}

@group(0) @binding(0) var<uniform> uniforms: RenderUniforms;
@group(0) @binding(1) var<uniform> time: f32;
@group(0) @binding(2) var cubemapTexture: texture_cube<f32>;
@group(0) @binding(3) var cubemapSampler: sampler;

fn gerstnerWave(position: vec2f, direction: vec2f, steepness: f32, wavelength: f32, time: f32) -> vec3f {
    let k = 2.0 * 3.14159265359 / wavelength;
    let c = sqrt(9.8 / k);
    let d = normalize(direction);
    let f = k * (dot(d, position) - c * time);
    let a = steepness / k;

    return vec3f(
        d.x * a * cos(f),
        a * sin(f),
        d.y * a * cos(f)
    );
}

fn gerstnerWaveNormal(position: vec2f, direction: vec2f, steepness: f32, wavelength: f32, time: f32) -> vec3f {
    let k = 2.0 * 3.14159265359 / wavelength;
    let c = sqrt(9.8 / k);
    let d = normalize(direction);
    let f = k * (dot(d, position) - c * time);
    let a = steepness / k;

    let wa = k * a;
    let s = sin(f);
    let c_val = cos(f);

    return vec3f(
        -d.x * wa * c_val,
        1.0 - steepness * s,
        -d.y * wa * c_val
    );
}

@vertex
fn vs_main(@location(0) position: vec3f) -> VertexOutput {
    var output: VertexOutput;

    let pos2d = position.xz;
    let t = time * 0.5;

    var offset = vec3f(0.0, 0.0, 0.0);
    var normal = vec3f(0.0, 1.0, 0.0);

    offset += gerstnerWave(pos2d, vec2f(1.0, 0.0), 0.5, 12.0, t);
    offset += gerstnerWave(pos2d, vec2f(0.7, 0.7), 0.35, 8.0, t * 1.2);
    offset += gerstnerWave(pos2d, vec2f(-0.5, 0.8), 0.25, 5.0, t * 1.5);
    offset += gerstnerWave(pos2d, vec2f(0.3, -0.9), 0.15, 3.0, t * 2.0);

    normal += gerstnerWaveNormal(pos2d, vec2f(1.0, 0.0), 0.5, 12.0, t);
    normal += gerstnerWaveNormal(pos2d, vec2f(0.7, 0.7), 0.35, 8.0, t * 1.2);
    normal += gerstnerWaveNormal(pos2d, vec2f(-0.5, 0.8), 0.25, 5.0, t * 1.5);
    normal += gerstnerWaveNormal(pos2d, vec2f(0.3, -0.9), 0.15, 3.0, t * 2.0);

    normal = normalize(normal);

    let worldPos = vec4f(position + offset, 1.0);
    let viewPos = uniforms.view_matrix * worldPos;

    output.position = uniforms.projection_matrix * viewPos;
    output.worldPos = worldPos.xyz;
    output.normal = normal;
    output.viewPos = viewPos.xyz;

    return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
    let normal = normalize(input.normal);
    let viewDir = normalize(-input.viewPos);

    let lightDir = normalize(vec3f(0.5, 1.0, 0.3));
    let diffuse = max(dot(normal, lightDir), 0.0) * 0.6 + 0.4;

    let worldViewDir = (uniforms.inv_view_matrix * vec4f(viewDir, 0.0)).xyz;
    let reflectDir = reflect(-worldViewDir, normal);
    let reflection = textureSample(cubemapTexture, cubemapSampler, reflectDir).rgb;

    let fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    let oceanColor = vec3f(0.0, 0.15, 0.3);

    let finalColor = mix(oceanColor * diffuse, reflection, fresnel * 0.8 + 0.2);

    return vec4f(finalColor, 0.85);
}
