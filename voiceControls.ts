export class VoiceControls {
    private controlsElement: HTMLDivElement;
    private statusElement: HTMLDivElement;
    private startButton: HTMLButtonElement;
    private endButton: HTMLButtonElement;
    private statusText: HTMLSpanElement;

    constructor() {
        this.createControls();
    }

    private createControls() {
        // Main controls container
        this.controlsElement = document.createElement('div');
        this.controlsElement.id = 'voice-controls';
        this.controlsElement.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 15px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 1001;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        // Status indicator
        this.statusElement = document.createElement('div');
        this.statusElement.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        const statusDot = document.createElement('div');
        statusDot.id = 'status-dot';
        statusDot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ff4444;
            transition: background-color 0.3s ease;
        `;

        this.statusText = document.createElement('span');
        this.statusText.textContent = 'Voice bot offline';
        this.statusText.style.cssText = `
            min-width: 120px;
        `;

        this.statusElement.appendChild(statusDot);
        this.statusElement.appendChild(this.statusText);

        // Start button
        this.startButton = document.createElement('button');
        this.startButton.textContent = '🎤 Start Voice';
        this.startButton.style.cssText = `
            background: #4CAF50;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.3s ease;
        `;
        this.startButton.addEventListener('mouseenter', () => {
            this.startButton.style.background = '#45a049';
        });
        this.startButton.addEventListener('mouseleave', () => {
            this.startButton.style.background = '#4CAF50';
        });

        // End button
        this.endButton = document.createElement('button');
        this.endButton.textContent = '🔇 End Voice';
        this.endButton.style.cssText = `
            background: #f44336;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.3s ease;
            opacity: 0.5;
        `;
        this.endButton.disabled = true;
        this.endButton.addEventListener('mouseenter', () => {
            if (!this.endButton.disabled) {
                this.endButton.style.background = '#da190b';
            }
        });
        this.endButton.addEventListener('mouseleave', () => {
            if (!this.endButton.disabled) {
                this.endButton.style.background = '#f44336';
            }
        });

        // Assemble controls
        this.controlsElement.appendChild(this.statusElement);
        this.controlsElement.appendChild(this.startButton);
        this.controlsElement.appendChild(this.endButton);

        document.body.appendChild(this.controlsElement);
    }

    updateStatus(status: string, isConnected: boolean = false, isListening: boolean = false) {
        this.statusText.textContent = status;
        
        const statusDot = document.getElementById('status-dot');
        if (statusDot) {
            if (isListening) {
                statusDot.style.background = '#4CAF50';
                statusDot.style.animation = 'pulse 1s infinite';
            } else if (isConnected) {
                statusDot.style.background = '#2196F3';
                statusDot.style.animation = 'none';
            } else {
                statusDot.style.background = '#ff4444';
                statusDot.style.animation = 'none';
            }
        }

        // Update button states
        this.startButton.disabled = isConnected;
        this.endButton.disabled = !isConnected;
        
        this.startButton.style.opacity = isConnected ? '0.5' : '1';
        this.endButton.style.opacity = isConnected ? '1' : '0.5';
    }

    onStartClick(callback: () => void) {
        this.startButton.addEventListener('click', callback);
    }

    onEndClick(callback: () => void) {
        this.endButton.addEventListener('click', callback);
    }

    destroy() {
        if (this.controlsElement && this.controlsElement.parentNode) {
            this.controlsElement.parentNode.removeChild(this.controlsElement);
        }
    }
}

// Add pulse animation to document
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(style);