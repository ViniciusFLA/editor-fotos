// Minimal ImageData polyfill for the Node test environment.
// `inpaintImageData` constructs ImageData and reads `data`/`width`/`height`,
// which are the only members exercised in unit tests.
if (typeof globalThis.ImageData === 'undefined') {
  const ImageDataImpl = class ImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;

    constructor(
      dataOrWidth: number | Uint8ClampedArray,
      widthOrHeight: number,
      height?: number,
    ) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height as number;
      }
    }
  };

  globalThis.ImageData = ImageDataImpl as unknown as typeof ImageData;
}

export {};
