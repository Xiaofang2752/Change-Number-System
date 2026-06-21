import '@testing-library/jest-dom';

// Mock Worker for tests since jsdom doesn't support Web Workers natively
class MockWorker {
  url: string;
  onmessage: (msg: MessageEvent) => void = () => {};
  constructor(stringUrl: string) {
    this.url = stringUrl;
  }
  postMessage(_msg: unknown) { void _msg; }
  terminate() {}
  addEventListener(..._args: unknown[]) { void _args; }
  removeEventListener(..._args: unknown[]) { void _args; }
}

(globalThis as unknown as Record<string, unknown>)["Worker"] = MockWorker;

// Mock scrollIntoView for Radix UI dropdown components in JSDOM
window.HTMLElement.prototype.scrollIntoView = function() {};
