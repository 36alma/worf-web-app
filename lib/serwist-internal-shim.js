class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

const noop = () => {};

const logger = {
  debug: noop,
  error: noop,
  groupCollapsed: noop,
  groupEnd: noop,
  log: noop,
  warn: noop,
};

export { Deferred, logger };
