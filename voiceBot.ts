import { ElevenLabsConversationClient } from '@11labs/client';

export class VoiceBot {
    private conversation: any = null;
    private isConnected: boolean = false;
    private isListening: boolean = false;
    private statusCallback?: (status: string) => void;

    constructor(statusCallback?: (status: string) => void) {
        this.statusCallback = statusCallback;
    }

    async initialize() {
        try {
            this.updateStatus('Initializing voice bot...');
            
            this.conversation = new ElevenLabsConversationClient({
                agentId: 'agent_01jw3bjvvvekdtn78n3tpq1ndg',
                apiKey: 'sk_b7780b8dcd96f7f079a2baf650a6e1ea5120732840daaa22',
                onConnect: () => {
                    this.isConnected = true;
                    this.updateStatus('Voice bot connected');
                    console.log('Voice bot connected successfully');
                },
                onDisconnect: () => {
                    this.isConnected = false;
                    this.isListening = false;
                    this.updateStatus('Voice bot disconnected');
                    console.log('Voice bot disconnected');
                },
                onError: (error: any) => {
                    console.error('Voice bot error:', error);
                    this.updateStatus('Voice bot error');
                },
                onModeChange: (mode: any) => {
                    this.isListening = mode.mode === 'listening';
                    this.updateStatus(mode.mode === 'listening' ? 'Listening...' : 'Speaking...');
                    console.log('Voice bot mode changed:', mode);
                }
            });

            await this.conversation.startSession();
            this.updateStatus('Voice bot ready');
            
        } catch (error) {
            console.error('Failed to initialize voice bot:', error);
            this.updateStatus('Failed to initialize voice bot');
        }
    }

    async startConversation() {
        if (!this.isConnected) {
            await this.initialize();
        }
        
        if (this.conversation && this.isConnected) {
            try {
                await this.conversation.startConversation();
                this.updateStatus('Conversation started');
            } catch (error) {
                console.error('Failed to start conversation:', error);
                this.updateStatus('Failed to start conversation');
            }
        }
    }

    async endConversation() {
        if (this.conversation && this.isConnected) {
            try {
                await this.conversation.endConversation();
                this.updateStatus('Conversation ended');
            } catch (error) {
                console.error('Failed to end conversation:', error);
            }
        }
    }

    async disconnect() {
        if (this.conversation) {
            try {
                await this.conversation.endSession();
                this.updateStatus('Voice bot disconnected');
            } catch (error) {
                console.error('Failed to disconnect voice bot:', error);
            }
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            isListening: this.isListening
        };
    }

    private updateStatus(status: string) {
        if (this.statusCallback) {
            this.statusCallback(status);
        }
    }
}