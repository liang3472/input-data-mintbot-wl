export default class PromiseQueue {
  constructor(options = {}) {
      this.concurrency = options.concurrency || 1;
      this._current = 0;
      this._list = [];
  }

  add(promiseFn) {
      this._list.push(promiseFn);
      this.loadNext();
  }

  loadNext() {
      if (this._list.length === 0 || this.concurrency === this._current) return;

      this._current++;
      const fn = this._list.shift();
      const promise = fn && fn();
      promise.then(this.onLoaded.bind(this)).catch(this.onLoaded.bind(this));
  }

  onLoaded() {
      this._current--;
      this.loadNext();
  }
}