// Lightweight, framework-friendly event bus for React Native
type Handler<T = any> = (payload?: T) => void;

class SimpleEventBus {
  private listeners: Map<string, Set<Handler>> = new Map();

  on<T = any>(eventName: string, handler: Handler<T>) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName)!.add(handler as Handler);
  }

  off<T = any>(eventName: string, handler?: Handler<T>) {
    if (!this.listeners.has(eventName)) return;
    if (!handler) {
      this.listeners.delete(eventName);
      return;
    }
    const set = this.listeners.get(eventName)!;
    set.delete(handler as Handler);
    if (set.size === 0) this.listeners.delete(eventName);
  }

  emit<T = any>(eventName: string, payload?: T) {
    const set = this.listeners.get(eventName);
    if (!set) return;
    // Call handlers copy to avoid issues if listener list is modified during emit
    [...set].forEach(h => {
      try { h(payload); } catch (err) { /* swallow handler errors */ }
    });
  }
}

const eventBus = new SimpleEventBus();
export { eventBus };
export default eventBus;
