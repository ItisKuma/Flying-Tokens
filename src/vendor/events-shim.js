class EventEmitter {
  constructor() {
    this._events = new Map();
    this._maxListeners = 100;
  }

  setMaxListeners(count) {
    this._maxListeners = count;
    return this;
  }

  on(eventName, listener) {
    return this.addListener(eventName, listener);
  }

  addListener(eventName, listener) {
    const listeners = this._events.get(eventName) ?? [];
    listeners.push(listener);
    this._events.set(eventName, listeners);
    return this;
  }

  once(eventName, listener) {
    const wrapped = (...args) => {
      this.off(eventName, wrapped);
      listener(...args);
    };

    wrapped.listener = listener;
    return this.on(eventName, wrapped);
  }

  off(eventName, listener) {
    return this.removeListener(eventName, listener);
  }

  removeListener(eventName, listener) {
    const listeners = this._events.get(eventName);
    if (!listeners) return this;

    const next = listeners.filter(
      (candidate) =>
        candidate !== listener && candidate.listener !== listener,
    );

    if (next.length === 0) {
      this._events.delete(eventName);
    } else {
      this._events.set(eventName, next);
    }

    return this;
  }

  emit(eventName, ...args) {
    const listeners = this._events.get(eventName);
    if (!listeners || listeners.length === 0) return false;

    for (const listener of [...listeners]) {
      listener(...args);
    }

    return true;
  }
}

function once(emitter, eventName) {
  return new Promise((resolve, reject) => {
    function handleEvent(...args) {
      emitter.off("error", handleError);
      resolve(args);
    }

    function handleError(error) {
      emitter.off(eventName, handleEvent);
      reject(error);
    }

    emitter.once(eventName, handleEvent);

    if (eventName !== "error") {
      emitter.once("error", handleError);
    }
  });
}

export { EventEmitter, once };
export default { EventEmitter, once };
