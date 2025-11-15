struct Particle {
    position: vec3f, 
    v: vec3f, 
    C: mat3x3f, 
}
struct Cell {
    vx: i32, 
    vy: i32, 
    vz: i32, 
    mass: i32, 
}

override fixed_point_multiplier: f32; 
override dt: f32; 

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<storage, read> cells: array<Cell>;
@group(0) @binding(2) var<uniform> real_box_size: vec3f;
@group(0) @binding(3) var<uniform> init_box_size: vec3f;
@group(0) @binding(4) var<uniform> numParticles: u32;
@group(0) @binding(5) var<uniform> sphereRadius: f32;

fn decodeFixedPoint(fixed_point: i32) -> f32 {
	return f32(fixed_point) / fixed_point_multiplier;
}


@compute @workgroup_size(64)
fn g2p(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x < numParticles) {
        particles[id.x].v = vec3f(0.);
        var weights: array<vec3f, 3>;

        let particle = particles[id.x];
        let cell_idx: vec3f = floor(particle.position);
        let cell_diff: vec3f = particle.position - (cell_idx + 0.5f);
        weights[0] = 0.5f * (0.5f - cell_diff) * (0.5f - cell_diff);
        weights[1] = 0.75f - cell_diff * cell_diff;
        weights[2] = 0.5f * (0.5f + cell_diff) * (0.5f + cell_diff);

        var B: mat3x3f = mat3x3f(vec3f(0.), vec3f(0.), vec3f(0.));
        for (var gx = 0; gx < 3; gx++) {
            for (var gy = 0; gy < 3; gy++) {
                for (var gz = 0; gz < 3; gz++) {
                    let weight: f32 = weights[gx].x * weights[gy].y * weights[gz].z;
                    let cell_x: vec3f = vec3f(
                        cell_idx.x + f32(gx) - 1., 
                        cell_idx.y + f32(gy) - 1.,
                        cell_idx.z + f32(gz) - 1.  
                    );
                    let cell_dist: vec3f = (cell_x + 0.5f) - particle.position;
                    let cell_index: i32 = 
                        i32(cell_x.x) * i32(init_box_size.y) * i32(init_box_size.z) + 
                        i32(cell_x.y) * i32(init_box_size.z) + 
                        i32(cell_x.z);
                    let weighted_velocity: vec3f = vec3f(
                        decodeFixedPoint(cells[cell_index].vx), 
                        decodeFixedPoint(cells[cell_index].vy), 
                        decodeFixedPoint(cells[cell_index].vz)
                    ) * weight;
                    let term: mat3x3f = mat3x3f(
                        weighted_velocity * cell_dist.x, 
                        weighted_velocity * cell_dist.y, 
                        weighted_velocity * cell_dist.z
                    );

                    B += term;

                    particles[id.x].v += weighted_velocity;
                }
            }
        }

        particles[id.x].C = B * 4.0f;
        particles[id.x].position += particles[id.x].v * dt;

        let tube_radius: f32 = 15.0;
        let wave_center_x: f32 = real_box_size.x / 2.0;
        let center_y: f32 = real_box_size.y / 2.0;
        let center_z: f32 = real_box_size.z / 2.0;
        let pos = particles[id.x].position;

        let radial_dist_yz = sqrt((pos.y - center_y) * (pos.y - center_y) + (pos.z - center_z) * (pos.z - center_z));

        let flow_force: f32 = 2.0;
        particles[id.x].v.x += flow_force * dt;

        let wave_ramp_start: f32 = wave_center_x - 15.0;
        let wave_ramp_end: f32 = wave_center_x - 5.0;
        let wave_curl_start: f32 = wave_center_x - 5.0;
        let wave_curl_end: f32 = wave_center_x + 10.0;

        if (pos.x >= wave_ramp_start && pos.x <= wave_ramp_end) {
            let ramp_progress = (pos.x - wave_ramp_start) / (wave_ramp_end - wave_ramp_start);
            let lift_strength = 8.0 * ramp_progress;
            particles[id.x].v.y += lift_strength * dt;
        }

        if (pos.x >= wave_curl_start && pos.x <= wave_curl_end) {
            let curl_progress = (pos.x - wave_curl_start) / (wave_curl_end - wave_curl_start);
            let wave_height = center_y + 8.0;

            if (pos.y > wave_height) {
                let curl_strength = 3.0;
                particles[id.x].v.x -= curl_strength * curl_progress * dt;
                particles[id.x].v.y -= curl_strength * 1.5 * dt;

                let barrel_hollow_radius = 8.0;
                let angle = atan2(pos.z - center_z, pos.y - center_y);
                let target_y = center_y + barrel_hollow_radius * cos(angle + 3.14159 * 0.3);
                let target_z = center_z + barrel_hollow_radius * sin(angle + 3.14159 * 0.3);

                particles[id.x].v.y += (target_y - pos.y) * 0.3 * dt;
                particles[id.x].v.z += (target_z - pos.z) * 0.3 * dt;
            }
        }

        if (radial_dist_yz > tube_radius) {
            let radial_dir_y = (center_y - pos.y) / radial_dist_yz;
            let radial_dir_z = (center_z - pos.z) / radial_dist_yz;
            let confinement_strength = 5.0;
            particles[id.x].v.y += radial_dir_y * confinement_strength * dt;
            particles[id.x].v.z += radial_dir_z * confinement_strength * dt;
        }

        if (pos.x > real_box_size.x - 10.0) {
            particles[id.x].position.x = 5.0 + fract(sin(f32(id.x) * 12.9898) * 43758.5453) * 2.0;
            particles[id.x].position.y = center_y + (fract(sin(f32(id.x) * 78.233) * 43758.5453) - 0.5) * tube_radius;
            particles[id.x].position.z = center_z + (fract(sin(f32(id.x) * 45.164) * 43758.5453) - 0.5) * tube_radius;
            particles[id.x].v = vec3f(8.0, 0.0, 0.0);
            particles[id.x].C = mat3x3f(vec3f(0.), vec3f(0.), vec3f(0.));
        }

        particles[id.x].position = vec3f(
            clamp(particles[id.x].position.x, 1., real_box_size.x - 2.),
            clamp(particles[id.x].position.y, 1., real_box_size.y - 2.),
            clamp(particles[id.x].position.z, 1., real_box_size.z - 2.)
        );

        let k = 3.0;
        let wall_stiffness = 1.0;
        let x_n: vec3f = particles[id.x].position + particles[id.x].v * dt * k;
        let wall_min: vec3f = vec3f(3.);
        let wall_max: vec3f = real_box_size - 4.;
        if (x_n.y < wall_min.y) { particles[id.x].v.y += wall_stiffness * (wall_min.y - x_n.y); }
        if (x_n.y > wall_max.y) { particles[id.x].v.y += wall_stiffness * (wall_max.y - x_n.y); }
        if (x_n.z < wall_min.z) { particles[id.x].v.z += wall_stiffness * (wall_min.z - x_n.z); }
        if (x_n.z > wall_max.z) { particles[id.x].v.z += wall_stiffness * (wall_max.z - x_n.z); }
    }
}