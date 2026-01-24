export type EventHandler<T = any> = (data: T) => void;

export interface EventBus {
  emit<T>(event: string, data: T): void;
  on<T>(event: string, handler: EventHandler<T>): () => void;
  off(event: string, handler: EventHandler): void;
  clear(): void;
}

export class SimpleEventBus implements EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  emit<T>(event: string, data: T): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const handlers = this.listeners.get(event)!;
    handlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  // Debug method to see all registered events
  getRegisteredEvents(): string[] {
    return Array.from(this.listeners.keys());
  }

  // Debug method to get handler count for an event
  getHandlerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }
}