import oceanShader from './ocean.wgsl'

export class OceanRenderer {
    pipeline: GPURenderPipeline
    bindGroup: GPUBindGroup
    vertexBuffer: GPUBuffer
    indexBuffer: GPUBuffer
    timeBuffer: GPUBuffer
    indexCount: number
    device: GPUDevice
    time: number = 0

    constructor(
        device: GPUDevice,
        presentationFormat: GPUTextureFormat,
        renderUniformBuffer: GPUBuffer,
        cubemapTextureView: GPUTextureView
    ) {
        this.device = device

        const oceanModule = device.createShaderModule({ code: oceanShader })

        const sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear'
        })

        this.timeBuffer = device.createBuffer({
            label: 'ocean time buffer',
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        this.pipeline = device.createRenderPipeline({
            label: 'ocean pipeline',
            layout: 'auto',
            vertex: {
                module: oceanModule,
                buffers: [{
                    arrayStride: 12,
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3'
                    }]
                }]
            },
            fragment: {
                module: oceanModule,
                targets: [{
                    format: presentationFormat,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        }
                    }
                }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back'
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth32float'
            }
        })

        this.bindGroup = device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: renderUniformBuffer }},
                { binding: 1, resource: { buffer: this.timeBuffer }},
                { binding: 2, resource: cubemapTextureView },
                { binding: 3, resource: sampler }
            ]
        })

        const meshData = this.createOceanMesh(200, 200, 100)

        this.vertexBuffer = device.createBuffer({
            label: 'ocean vertex buffer',
            size: meshData.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        })
        device.queue.writeBuffer(this.vertexBuffer, 0, meshData.vertices)

        this.indexBuffer = device.createBuffer({
            label: 'ocean index buffer',
            size: meshData.indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        })
        device.queue.writeBuffer(this.indexBuffer, 0, meshData.indices)

        this.indexCount = meshData.indices.length
    }

    createOceanMesh(width: number, depth: number, resolution: number) {
        const vertices: number[] = []
        const indices: number[] = []

        const stepX = width / resolution
        const stepZ = depth / resolution
        const offsetX = -width / 2
        const offsetZ = -depth / 2
        const yPos = -20

        for (let z = 0; z <= resolution; z++) {
            for (let x = 0; x <= resolution; x++) {
                vertices.push(
                    offsetX + x * stepX,
                    yPos,
                    offsetZ + z * stepZ
                )
            }
        }

        for (let z = 0; z < resolution; z++) {
            for (let x = 0; x < resolution; x++) {
                const topLeft = z * (resolution + 1) + x
                const topRight = topLeft + 1
                const bottomLeft = (z + 1) * (resolution + 1) + x
                const bottomRight = bottomLeft + 1

                indices.push(topLeft, bottomLeft, topRight)
                indices.push(topRight, bottomLeft, bottomRight)
            }
        }

        return {
            vertices: new Float32Array(vertices),
            indices: new Uint32Array(indices)
        }
    }

    execute(
        context: GPUCanvasContext,
        commandEncoder: GPUCommandEncoder,
        depthTextureView: GPUTextureView,
        deltaTime: number
    ) {
        this.time += deltaTime * 0.001

        const timeArray = new Float32Array([this.time])
        this.device.queue.writeBuffer(this.timeBuffer, 0, timeArray)

        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.1, g: 0.2, b: 0.3, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTextureView,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        })

        renderPass.setPipeline(this.pipeline)
        renderPass.setBindGroup(0, this.bindGroup)
        renderPass.setVertexBuffer(0, this.vertexBuffer)
        renderPass.setIndexBuffer(this.indexBuffer, 'uint32')
        renderPass.drawIndexed(this.indexCount)
        renderPass.end()
    }
}
