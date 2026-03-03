/**
 * Manager para gestionar MutationObservers de forma centralizada
 */

export interface ObserverConfig {
  target: Node;
  callback: MutationCallback;
  options?: MutationObserverInit;
}

/**
 * Clase para gestionar múltiples MutationObservers
 */
export class MutationObserverManager {
  private observers: Map<Node, MutationObserver> = new Map();

  /**
   * Crea o actualiza un observer para un target
   */
  observe(config: ObserverConfig): void {
    // Desconectar observer existente si hay uno
    this.disconnect(config.target);
    
    const observer = new MutationObserver(config.callback);
    observer.observe(config.target, config.options);
    this.observers.set(config.target, observer);
  }

  /**
   * Desconecta el observer de un target específico
   */
  disconnect(target: Node): void {
    const observer = this.observers.get(target);
    if (observer) {
      observer.disconnect();
      this.observers.delete(target);
    }
  }

  /**
   * Desconecta todos los observers
   */
  disconnectAll(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }

  /**
   * Obtiene el número de observers activos
   */
  getCount(): number {
    return this.observers.size;
  }
}

