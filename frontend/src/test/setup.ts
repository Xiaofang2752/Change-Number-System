import '@testing-library/jest-dom';

// Mock Worker for tests since jsdom doesn't support Web Workers natively
class MockWorker {
  url: string;
  onmessage: (msg: any) => void = () => {};
  constructor(stringUrl: string) {
    this.url = stringUrl;
  }
  postMessage(_msg: any) {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}

(globalThis as any).Worker = MockWorker;

// Mock scrollIntoView for Radix UI dropdown components in JSDOM
window.HTMLElement.prototype.scrollIntoView = function() {};
