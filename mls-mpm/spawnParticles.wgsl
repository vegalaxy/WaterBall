struct Particle {
    position: vec3f,
    v: vec3f,
    C: mat3x3f,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> init_box_size: vec3f;
@group(0) @binding(2) var<uniform> numParticles: i32;

const PI: f32 = 3.14159265359;

@compute @workgroup_size(1)
fn spawn() {
    let dx: f32 = 0.5;
    let center: vec3f = init_box_size / 2;
    let beg: vec3f = vec3f(10, center.y - 2.5, center.z - 2.5);

    let dummy = numParticles;

    for (var i = 0; i < 10; i++) {
        for (var j = 0; j < 10; j++) {
            var offset = 10 * i + j;
            let pos = beg + vec3f(0, f32(i), f32(j)) * dx;
            particles[(numParticles - 1) - offset].position = pos;
            particles[(numParticles - 1) - offset].v = vec3f(0.0, 0.0, 0.0);
            particles[(numParticles - 1) - offset].C = mat3x3f(vec3f(0.), vec3f(0.), vec3f(0.));
        }
    }
}