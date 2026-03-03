/**
 * Utilidad para gestionar event listeners de forma centralizada
 */

export interface EventListenerBinding {
  target: EventTarget;
  type: string;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

/**
 * Clase para gestionar múltiples event listeners y limpiarlos fácilmente
 */
export class EventListenerManager {
  private listeners: EventListenerBinding[] = [];

  /**
   * Añade un event listener y lo registra para limpieza posterior
   */
  add(
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, handler, options);
    this.listeners.push({ target, type, handler, options });
  }

  /**
   * Remueve todos los event listeners registrados
   */
  removeAll(): void {
    this.listeners.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    this.listeners = [];
  }

  /**
   * Remueve un event listener específico
   */
  remove(
    target: EventTarget,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.removeEventListener(type, handler, options);
    this.listeners = this.listeners.filter(
      (binding) =>
        !(binding.target === target && binding.type === type && binding.handler === handler)
    );
  }

  /**
   * Obtiene el número de listeners registrados
   */
  getCount(): number {
    return this.listeners.length;
  }
}

