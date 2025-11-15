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
    let tube_radius: f32 = 15.0;
    let center_y: f32 = init_box_size.y / 2.0;
    let center_z: f32 = init_box_size.z / 2.0;
    let spawn_x: f32 = 10.0;
    let flow_velocity: f32 = 12.0;
    let radial_layers: i32 = 5;
    let particles_per_layer: i32 = 20;

    let dummy = numParticles;
    var particle_idx: i32 = 0;

    for (var layer = 0; layer < radial_layers; layer++) {
        let radius_fraction = (f32(layer) + 0.5) / f32(radial_layers);
        let current_radius = tube_radius * radius_fraction * 0.75;

        for (var angle_idx = 0; angle_idx < particles_per_layer; angle_idx++) {
            if (particle_idx >= 100) {
                break;
            }

            let angle = (f32(angle_idx) / f32(particles_per_layer)) * 2.0 * PI;
            let y_offset = current_radius * cos(angle);
            let z_offset = current_radius * sin(angle);

            let jitter_x = (fract(sin(f32(particle_idx) * 12.9898) * 43758.5453) - 0.5) * 0.8;
            let jitter_y = (fract(sin(f32(particle_idx) * 78.233) * 43758.5453) - 0.5) * 0.4;
            let jitter_z = (fract(sin(f32(particle_idx) * 45.164) * 43758.5453) - 0.5) * 0.4;

            let pos = vec3f(
                spawn_x + jitter_x,
                center_y + y_offset + jitter_y,
                center_z + z_offset + jitter_z
            );

            let vel = vec3f(flow_velocity, 0.0, 0.0);

            particles[(numParticles - 1) - particle_idx].position = pos;
            particles[(numParticles - 1) - particle_idx].v = vel;
            particles[(numParticles - 1) - particle_idx].C = mat3x3f(vec3f(0.), vec3f(0.), vec3f(0.));

            particle_idx += 1;
        }
    }
}