/** @import {ViewElement, ViewControl, Mouse} from "./view.js" */
import { View, ViewIntControl } from "./view.js";

import { Matrix, Rectangle, Vec2d } from "./geometry.js";

/** @typedef {{session: string, expiry: string, tileWidth: number, imageFormat: "jpeg" | string, tileHeight:number}} TileSession */
const view = new View(
  /** @type {HTMLDivElement} */ (document.getElementById("root")),
);

/**
 * @implements {ViewElement}
 */
class Map {
  #angle = new ViewIntControl("angle", 0, 0, 360);
  controls = /** @type {ViewControl<any>[]} */ ([]);
  name = "Map";
  /** @type {Vec2d | null} */ #mapPan = null;
  /** @type {number | null} */ #mapZoom = null;
  /** @type {Record<string, Promise<HTMLImageElement | null>>} */ #tilePromises =
    {};

  /**@type {{rectangle: Rectangle, offscreenCanvas: OffscreenCanvas}} */ #ocBase =
    {
      rectangle: new Rectangle(new Vec2d(0, 0), new Vec2d(1, 1)),
      offscreenCanvas: new OffscreenCanvas(1, 1),
    };
  boundingRectangle = new Rectangle(new Vec2d(0, 0), new Vec2d(1000, 1000));
  /** @type {Vec2d}  */ #tileSize = new Vec2d(256, 256);
  constructor() {
    this.#targetTiles(
      new Rectangle(new Vec2d(0, 0), new Vec2d(1, 1)),
      screen.height * 2,
    ).then((res) => {
      if (res) {
        this.#ocBase = res;
      }
    });
  }
  /**
   * @param {Vec2d} position
   * @param {number} zoom
   * @returns {Promise<HTMLImageElement | null>}
   */
  #getTile(position, zoom) {
    const key = `${zoom}/${position.x}/${position.y}`;
    if (key in this.#tilePromises) {
      return /** @type {Promise<HTMLImageElement | null>} */ (
        this.#tilePromises[key]
      );
    } else {
      const image = new Image();
      image.src = `https://mt0.google.com/vt/lyrs=s&x=${position.x}&y=${position.y}&z=${zoom}`;
      const promise = new Promise((res) => {
        image.addEventListener("load", () => res(image), { once: true });
        image.addEventListener("error", () => res(null), { once: true });
      });
      this.#tilePromises[key] = promise;
      return promise;
    }
  }
  #targetTilesKey = "";
  /**
   * @param {Rectangle} rectangle
   * @param {number} viewportHeight
   * @return {Promise<{rectangle: Rectangle, offscreenCanvas: OffscreenCanvas} | null>}
   */
  async #targetTiles(rectangle, viewportHeight) {
    const count = viewportHeight / this.#tileSize.y;
    const zoom = Math.ceil(Math.log2(1 / (rectangle.size.y / count)));
    const size = 1 / Math.pow(2, zoom);
    rectangle.position.scale(1 / size).floor();
    const newPos = rectangle.position.scale(1 / size).floor();
    const offset = rectangle.position.scale(1 / size).sub(newPos);
    const grid = new Rectangle(
      newPos,
      rectangle.size
        .scale(1 / size)
        .add(offset)
        .ceil(),
    );
    const key = grid.tuple.map(String).join("/");
    if (this.#targetTilesKey === key) {
      return Promise.resolve(null);
    }
    this.#targetTilesKey = key;
    const offscreenCanvas = new OffscreenCanvas(
      ...grid.size.mul(this.#tileSize).tuple,
    );
    const ctx = offscreenCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("no canvas2d context");
    }
    await Promise.all(
      grid.points().map(async (pos) => {
        const image = await this.#getTile(pos, zoom);
        if (image) {
          ctx.drawImage(image, ...pos.sub(newPos).mul(this.#tileSize).tuple);
        }
      }),
    );
    return { offscreenCanvas, rectangle: grid.scale(size) };
  }
  /**@type {boolean} */ #loading = false;
  /**@type {{rectangle: Rectangle, offscreenCanvas: OffscreenCanvas}} */ #oc = {
    rectangle: new Rectangle(new Vec2d(0, 0), new Vec2d(1, 1)),
    offscreenCanvas: new OffscreenCanvas(1, 1),
  };
  /**@type {string} */ #key = "";
  /**
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {Mouse} mouse
   * @param {Matrix} transform
   * @param {Vec2d} size
   */
  render(ctx, mouse, transform, size) {
    // const bounds = new Rectangle(pan, size).clamp(this.boundingRectangle);
    // const rect = bounds.div(this.boundingRectangle.size);
    // const z = bounds.size.y * zoom;
    // if (!this.#loading) {
    //   this.#loading = true;
    //   this.#targetTiles(rect, z).then((res) => {
    //     if(res) {
    //       this.#oc = res;
    //     }
    //             this.#loading = false;

    //   });
    // }
    ctx.drawImage(
      this.#ocBase.offscreenCanvas,
      ...this.#ocBase.rectangle.mul(this.boundingRectangle.size).tuple,
    );
    ctx.drawImage(
      this.#oc.offscreenCanvas,
      ...this.#oc.rectangle.mul(this.boundingRectangle.size).tuple,
    );
  }
}
view.appendChild(new Map());
