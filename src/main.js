/** @import {ViewElement, ViewControl, Mouse} from "./view.js" */
import { View } from "./view.js";

import { Rectangle, Vec2d } from "./geometry.js";
const GOOGLE_MAPS_API_KEY =
  localStorage.getItem("api-key") ?? prompt("enter google maps api key");
if (GOOGLE_MAPS_API_KEY) {
  localStorage.setItem("api-key", GOOGLE_MAPS_API_KEY);
}

/** @typedef {{session: string, expiry: string, tileWidth: number, imageFormat: "jpeg" | string, tileHeight:number}} TileSession */
const view = new View(
  /** @type {HTMLDivElement} */ (document.getElementById("root")),
);

/**
 * @implements {ViewElement}
 */
class Map {
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
  /** @type {TileSession} */ #session;
  /** @type {Vec2d}  */ #sessionTileSize;
  /**
   * @param {TileSession} session
   */
  constructor(session) {
    this.#session = session;
    this.#sessionTileSize = new Vec2d(session.tileWidth, session.tileHeight);
    this.#targetTiles(
      new Rectangle(new Vec2d(0, 0), new Vec2d(1, 1)),
      screen.height * 2,
    ).then((res) => (this.#ocBase = res));
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
      image.src = `https://tile.googleapis.com/v1/2dtiles/${key}?session=${this.#session.session}&key=${GOOGLE_MAPS_API_KEY}`;
      const promise = new Promise((res) => {
        image.addEventListener("load", () => res(image), { once: true });
        image.addEventListener("error", () => res(null), { once: true });
      });
      this.#tilePromises[key] = promise;
      return promise;
    }
  }
  /**
   * @param {Rectangle} rectangle
   * @param {number} viewportHeight
   * @return {Promise<{rectangle: Rectangle, offscreenCanvas: OffscreenCanvas}>}
   */
  async #targetTiles(rectangle, viewportHeight) {
    const count = viewportHeight / this.#sessionTileSize.y;
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
    const offscreenCanvas = new OffscreenCanvas(
      ...grid.size.mul(this.#sessionTileSize).tuple,
    );
    const ctx = offscreenCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("no canvas2d context");
    }
    await Promise.all(
      grid.points().map(async (pos) => {
        const image = await this.#getTile(pos, zoom);
        if (image) {
          ctx.drawImage(
            image,
            ...pos.sub(newPos).mul(this.#sessionTileSize).tuple,
          );
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
   * @param {Vec2d} pan
   * @param {number} zoom
   * @param {Vec2d} size
   */
  render(ctx, mouse, pan, zoom, size) {
    const rect = new Rectangle(pan, size)
      .clamp(this.boundingRectangle)
      .div(this.boundingRectangle.size);
    const z = size.y * zoom;
    const key = [...rect.tuple, z].map(String).join("/");
    if (!this.#loading && key !== this.#key) {
      this.#key = key;
      this.#loading = true;
      this.#targetTiles(rect, z).then((res) => {
        console.log(res);
        this.#oc = res;
        this.#loading = false;
      });
    }
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

const sessionString = localStorage.getItem("session");
let session = sessionString && JSON.parse(sessionString);
if (!session) {
  /**@type {TileSession} */
  fetch(
    `https://tile.googleapis.com/v1/createSession?key=${GOOGLE_MAPS_API_KEY}`,
    {
      method: "POST",
      body: JSON.stringify({
        mapType: "satellite",
        language: "en-US",
        region: "US",
      }),
    },
  ).then(async (x) => {
    const res = /** @type {TileSession} */ (await x.json());
    localStorage.setItem("session", JSON.stringify(res));
    session = res;
    console.log(session);
  });
} else {
  view.appendChild(new Map(session));
}
