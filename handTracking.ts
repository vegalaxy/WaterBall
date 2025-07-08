import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export interface HandPosition {
    x: number;
    y: number;
    isDetected: boolean;
}

export class HandTracker {
    private hands: Hands;
    private camera: Camera;
    private videoElement: HTMLVideoElement;
    private canvasElement: HTMLCanvasElement;
    private onHandUpdate: (position: HandPosition) => void;
    private currentPosition: HandPosition = { x: 0, y: 0, isDetected: false };
    private previousPosition: HandPosition = { x: 0, y: 0, isDetected: false };

    constructor(onHandUpdate: (position: HandPosition) => void) {
        this.onHandUpdate = onHandUpdate;
        this.setupElements();
        this.initializeMediaPipe();
    }

    private setupElements() {
        // Create hidden video element for camera feed
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none';
        document.body.appendChild(this.videoElement);

        // Create hidden canvas for MediaPipe processing
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.style.display = 'none';
        document.body.appendChild(this.canvasElement);
    }

    private initializeMediaPipe() {
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults(this.onResults.bind(this));
    }

    private onResults(results: Results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            // Index finger tip is landmark 8
            const indexFingerTip = landmarks[8];
            
            // Convert normalized coordinates to window coordinates
            // MediaPipe coordinates are normalized (0-1) and horizontally mirrored
            const handScreenX = (1 - indexFingerTip.x) * window.innerWidth;
            const handScreenY = indexFingerTip.y * window.innerHeight;

            this.previousPosition = { ...this.currentPosition };
            this.currentPosition = {
                x: handScreenX,
                y: handScreenY,
                isDetected: true
            };
        } else {
            this.previousPosition = { ...this.currentPosition };
            this.currentPosition = {
                x: this.currentPosition.x,
                y: this.currentPosition.y,
                isDetected: false
            };
        }

        this.onHandUpdate(this.currentPosition);
    }

    public async start() {
        try {
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    await this.hands.send({ image: this.videoElement });
                },
                width: 640,
                height: 480
            });

            await this.camera.start();
            console.log('Hand tracking started successfully');
        } catch (error) {
            console.error('Failed to start hand tracking:', error);
        }
    }

    public stop() {
        if (this.camera) {
            this.camera.stop();
        }
    }

    public getCurrentPosition(): HandPosition {
        return this.currentPosition;
    }

    public getPreviousPosition(): HandPosition {
        return this.previousPosition;
    }

    public getVelocity(): { x: number, y: number } {
        if (!this.currentPosition.isDetected || !this.previousPosition.isDetected) {
            return { x: 0, y: 0 };
        }

        return {
            x: this.currentPosition.x - this.previousPosition.x,
            y: this.currentPosition.y - this.previousPosition.y
        };
    }
}