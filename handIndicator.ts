export class HandIndicator {
    private indicatorElement: HTMLDivElement;
    private isVisible: boolean = false;

    constructor() {
        this.createIndicator();
    }

    private createIndicator() {
        this.indicatorElement = document.createElement('div');
        this.indicatorElement.id = 'hand-indicator';
        this.indicatorElement.style.cssText = `
            position: fixed;
            width: 20px;
            height: 20px;
            background: radial-gradient(circle, rgba(0, 255, 255, 0.8) 0%, rgba(0, 255, 255, 0.3) 70%, transparent 100%);
            border: 2px solid rgba(0, 255, 255, 0.9);
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
            transform: translate(-50%, -50%);
            transition: opacity 0.2s ease;
            opacity: 0;
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
        `;
        document.body.appendChild(this.indicatorElement);
    }

    public updatePosition(x: number, y: number, isDetected: boolean) {
        if (isDetected) {
            this.indicatorElement.style.left = `${x}px`;
            this.indicatorElement.style.top = `${y}px`;
            
            if (!this.isVisible) {
                this.indicatorElement.style.opacity = '1';
                this.isVisible = true;
            }
        } else {
            if (this.isVisible) {
                this.indicatorElement.style.opacity = '0';
                this.isVisible = false;
            }
        }
    }

    public setActive(active: boolean) {
        if (active) {
            this.indicatorElement.style.background = 'radial-gradient(circle, rgba(255, 100, 100, 0.8) 0%, rgba(255, 100, 100, 0.3) 70%, transparent 100%)';
            this.indicatorElement.style.borderColor = 'rgba(255, 100, 100, 0.9)';
            this.indicatorElement.style.boxShadow = '0 0 20px rgba(255, 100, 100, 0.7)';
        } else {
            this.indicatorElement.style.background = 'radial-gradient(circle, rgba(0, 255, 255, 0.8) 0%, rgba(0, 255, 255, 0.3) 70%, transparent 100%)';
            this.indicatorElement.style.borderColor = 'rgba(0, 255, 255, 0.9)';
            this.indicatorElement.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.5)';
        }
    }

    public destroy() {
        if (this.indicatorElement && this.indicatorElement.parentNode) {
            this.indicatorElement.parentNode.removeChild(this.indicatorElement);
        }
    }
}