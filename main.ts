import { mat4 } from 'wgpu-matrix'

import { Camera } from './camera'
import { mlsmpmParticleStructSize, MLSMPMSimulator } from './mls-mpm/mls-mpm'
import { renderUniformsViews, renderUniformsValues, numParticlesMax } from './common'
import { FluidRenderer } from './render/fluidRender'
import { HandTracker, HandPosition } from './handTracking'
import { HandIndicator } from './handIndicator'

/// <reference types="@webgpu/types" />


async function init() {
	const canvas: HTMLCanvasElement = document.querySelector('canvas')!

	if (!navigator.gpu) {
		alert("WebGPU is not supported on your browser.");
		throw new Error()
	}

	const adapter = await navigator.gpu.requestAdapter()

	if (!adapter) {
		alert("Adapter is not available.");
		throw new Error()
	}

	const device = await adapter.requestDevice()

	const context = canvas.getContext('webgpu') as GPUCanvasContext

	if (!context) {
		throw new Error()	
	}

	// const { devicePixelRatio } = window
	// let devicePixelRatio  = 5.0;
	let devicePixelRatio  = 0.7;
	canvas.width = devicePixelRatio * canvas.clientWidth
	canvas.height = devicePixelRatio * canvas.clientHeight

	const presentationFormat = navigator.gpu.getPreferredCanvasFormat()

	context.configure({
		device,
		format: presentationFormat,
	})

	return { canvas, device, presentationFormat, context }
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
  

async function main() {
	const { canvas, device, presentationFormat, context } = await init();

	// ボタン押下の監視
	let numberButtonForm = document.getElementById('number-button') as HTMLFormElement;
	let numberButtonPressed = false;
	let numberButtonPressedButton = "1"
	numberButtonForm.addEventListener('change', function(event) {
		const target = event.target as HTMLInputElement
		if (target?.name === 'options') {
			numberButtonPressed = true
			numberButtonPressedButton = target.value
		}
	}); 
	const smallValue = document.getElementById("small-value") as HTMLSpanElement;
	const mediumValue = document.getElementById("medium-value") as HTMLSpanElement;
	const largeValue = document.getElementById("large-value") as HTMLSpanElement;
	

	console.log("initialization done")

	context.configure({
		device,
		format: presentationFormat,
	})

	let cubemapTexture: GPUTexture;
	{
		// The order of the array layers is [+X, -X, +Y, -Y, +Z, -Z]
		const imgSrcs = [
			'cubemap/posx.png',
			'cubemap/negx.png',
			'cubemap/posy.png',
			'cubemap/negy.png',
			'cubemap/posz.png',
			'cubemap/negz.png',
		];
		const promises = imgSrcs.map(async (src) => {
			const response = await fetch(src);
			return createImageBitmap(await response.blob());
		});
		const imageBitmaps = await Promise.all(promises);

		cubemapTexture = device.createTexture({
			dimension: '2d',
			// Create a 2d array texture.
			// Assume each image has the same size.
			size: [imageBitmaps[0].width, imageBitmaps[0].height, 6],
			format: 'rgba8unorm',
			usage:
			GPUTextureUsage.TEXTURE_BINDING |
			GPUTextureUsage.COPY_DST |
			GPUTextureUsage.RENDER_ATTACHMENT,
		});

		for (let i = 0; i < imageBitmaps.length; i++) {
			const imageBitmap = imageBitmaps[i];
			device.queue.copyExternalImageToTexture(
				{ source: imageBitmap },
				{ texture: cubemapTexture, origin: [0, 0, i] },
				[imageBitmap.width, imageBitmap.height]
			);
		}
	}
	const cubemapTextureView = cubemapTexture.createView({
		dimension: 'cube',
	});
	console.log("cubemap initialization done")

	// uniform buffer を作る
	renderUniformsViews.texel_size.set([1.0 / canvas.width, 1.0 / canvas.height]);

	// storage buffer を作る
	const maxParticleStructSize = mlsmpmParticleStructSize
	const particleBuffer = device.createBuffer({
		label: 'particles buffer', 
		size: maxParticleStructSize * numParticlesMax, 
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
	const posvelBuffer = device.createBuffer({
		label: 'position buffer', 
		size: 32 * numParticlesMax,  // 32 = 2 x vec3f + 1 x f32 + padding
		usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
	})
	const renderUniformBuffer = device.createBuffer({
		label: 'filter uniform buffer', 
		size: renderUniformsValues.byteLength, 
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	})

	console.log("buffer allocating done")


	let mlsmpmNumParticleParams = [30000, 60000, 100000]
	let mlsmpmInitBoxSizes = [[52, 52, 52], [60, 60, 60], [72, 72, 72]]
	let mlsmpmInitDistances = [60, 70, 90]
	let radiuses = [15, 20, 25]
	let mouseRadiuses = [5, 6, 8]
	let stretchStrength = [2.5, 2.0, 1.5]

	const canvasElement = document.getElementById("fluidCanvas") as HTMLCanvasElement;
	// シミュレーション，カメラの初期化
	const mlsmpmFov = 45 * Math.PI / 180
	const mlsmpmRadius = 0.7
	const mlsmpmDiameter = 2 * mlsmpmRadius
	const mlsmpmZoomRate = 0.7
	const depthMapTexture = device.createTexture({
		label: 'depth map texture', 
		size: [canvas.width, canvas.height, 1],
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
		format: 'r32float',
	});
	const depthMapTextureView = depthMapTexture.createView()
	const mlsmpmSimulator = new MLSMPMSimulator(particleBuffer, posvelBuffer, mlsmpmDiameter, device, renderUniformBuffer, depthMapTextureView, canvas)
	const mlsmpmRenderer = new FluidRenderer(device, canvas, presentationFormat, mlsmpmRadius, mlsmpmFov, posvelBuffer, renderUniformBuffer, 
		cubemapTextureView, depthMapTextureView, mlsmpmSimulator.restDensity)

	// Hand tracking setup
	const handIndicator = new HandIndicator();
	let currentHandPosition: HandPosition = { x: 0, y: 0, isDetected: false };
	let previousHandPosition: HandPosition = { x: 0, y: 0, isDetected: false };
	
	const handTracker = new HandTracker((position: HandPosition) => {
		previousHandPosition = { ...currentHandPosition };
		currentHandPosition = position;
		handIndicator.updatePosition(position.x, position.y, position.isDetected);
		
		// Set indicator to active when hand is detected and moving
		const velocity = handTracker.getVelocity();
		const isActive = position.isDetected && (Math.abs(velocity.x) > 2 || Math.abs(velocity.y) > 2);
		handIndicator.setActive(isActive);
	});

	// Start hand tracking
	let handTrackingEnabled = false;
	try {
		await handTracker.start();
		console.log('Hand tracking initialized successfully');
		handTrackingEnabled = true;
	} catch (error) {
		console.warn('Hand tracking not available, continuing with mouse-only interaction');
		handTrackingEnabled = false;
	}

	console.log("simulator initialization done")

	const camera = new Camera(canvasElement);

	// デバイスロストの監視
	let errorLog = document.getElementById('error-reason') as HTMLSpanElement;
	errorLog.textContent = "";
	device.lost.then(info => {
		const reason = info.reason ? `reason: ${info.reason}` : 'unknown reason';
		errorLog.textContent = reason;
	});

	let paramsIdx = 1
	let initBoxSize = mlsmpmInitBoxSizes[paramsIdx]
	console.log("Init box size:", initBoxSize)
	console.log("Init distance:", mlsmpmInitDistances[paramsIdx])

	smallValue.textContent = "30,000"
	mediumValue.textContent = "60,000"
	largeValue.textContent = "100,000"

	let sphereRenderFl = false
	let rotateFl = false
	let startFl = true

	console.log("simulation start")
	async function frame() {
		const start = performance.now();

		if (numberButtonPressed || startFl) {
			paramsIdx = parseInt(numberButtonPressedButton)
			initBoxSize = mlsmpmInitBoxSizes[paramsIdx]
			mlsmpmSimulator.reset(initBoxSize, radiuses[paramsIdx])
			camera.reset(mlsmpmInitDistances[paramsIdx], [initBoxSize[0] / 2, initBoxSize[1] / 2, initBoxSize[2] / 2],
				mlsmpmFov, mlsmpmZoomRate)
			numberButtonPressed = false
			startFl = false
		}


		const slider = document.getElementById("slider") as HTMLInputElement
		const particle = document.getElementById("particle") as HTMLInputElement
		const rotate = document.getElementById("autorotate") as HTMLInputElement
		sphereRenderFl = particle.checked
		rotateFl = rotate.checked
		device.queue.writeBuffer(renderUniformBuffer, 0, renderUniformsValues) 

		const commandEncoder = device.createCommandEncoder()

		// 計算のためのパス
		// Use hand position if detected, otherwise fall back to mouse
		let interactionCoord: number[];
		let interactionVelocity: number[];
		
		if (currentHandPosition.isDetected) {
			// Convert hand screen coordinates to canvas coordinates
			const canvasRect = canvas.getBoundingClientRect();
			const handCanvasX = currentHandPosition.x - canvasRect.left;
			const handCanvasY = currentHandPosition.y - canvasRect.top;
			const prevHandCanvasX = previousHandPosition.x - canvasRect.left;
			const prevHandCanvasY = previousHandPosition.y - canvasRect.top;
			
			// Use normalized coordinates for interaction
			interactionCoord = [
				handCanvasX / canvas.clientWidth,
				handCanvasY / canvas.clientHeight
			];
			
			// Use camera's hand velocity calculation method for consistency
			interactionVelocity = camera.calcHandVelocity(
				handCanvasX, handCanvasY,
				prevHandCanvasX, prevHandCanvasY
			);
		} else {
			// Fall back to mouse interaction
			interactionCoord = [
				camera.currentHoverX / canvas.clientWidth, 
				camera.currentHoverY / canvas.clientHeight
			];
			interactionVelocity = camera.calcMouseVelocity();
		}
		
		mlsmpmSimulator.execute(commandEncoder, interactionCoord, interactionVelocity, 
			mlsmpmNumParticleParams[paramsIdx], mouseRadiuses[paramsIdx])
		mlsmpmRenderer.execute(context, commandEncoder, mlsmpmSimulator.numParticles, sphereRenderFl, stretchStrength[paramsIdx])

		device.queue.submit([commandEncoder.finish()])

		camera.setNewPrevMouseCoord();
		if (rotateFl) {
			camera.stepAngle();
		}

		const end = performance.now();

		requestAnimationFrame(frame)
	} 
	requestAnimationFrame(frame)
}

main()