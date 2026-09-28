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
  /** @type {Record<string, HTMLImageElement>} */ #imageCache = {};
  /** @type {OffscreenCanvas} */ #offscreenCanvas = new OffscreenCanvas(1, 1);
  /** @type {Vec2d} */ #offscreenCanvasPosition = new Vec2d(0, 0);
  boundingRectangle = new Rectangle(new Vec2d(0, 0), new Vec2d(1000, 1000));
  /** @type {Rectangle} */ #target = this.boundingRectangle;
  /** @type {TileSession} */ #session;
  /** @type {Vec2d}  */ #sessionTileSize;
  /**
   * @param {TileSession} session
   */
  constructor(session) {
    this.#session = session;
    this.#sessionTileSize = new Vec2d(session.tileWidth, session.tileHeight);
  }
  /**
   * @param {Vec2d} position
   * @param {number} zoom
   * @returns {HTMLImageElement | null}
   */
  #getTileSync(position, zoom) {
    const key = `${zoom}/${position.x}/${position.y}`;
    if (key in this.#imageCache) {
      return this.#imageCache[key] ?? null;
    } else {
      const image = new Image();
      image.src = `https://tile.googleapis.com/v1/2dtiles/${key}?session=${this.#session.session}&key=${GOOGLE_MAPS_API_KEY}`;
      image.addEventListener(
        "load",
        () => {
          this.#imageCache[key] = image;
        },
        { once: true },
      );
      image.addEventListener("error", () => {
        this.#imageCache[key] = image;
      });
      return null;
    }
  }
  /**
   * @param {Rectangle} rectangle
   * @param {number} viewportHeight
   * @return {Generator<[Rectangle, HTMLImageElement | null]>}
   */
  *#targetTiles(rectangle, viewportHeight) {
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
    yield* grid.points().map((pos) => {
      const image = this.#getTileSync(pos, zoom);
      return [new Rectangle(pos.scale(size), new Vec2d(size, size)), image];
    });
  }
  /**
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {Mouse} mouse
   * @param {Vec2d} pan
   * @param {number} zoom
   * @param {Vec2d} size
   */
  render(ctx, mouse, pan, zoom, size) {
    if (mouse.down) {
      this.#target = new Rectangle(pan, size).clamp(this.boundingRectangle);
    }
    ctx.strokeStyle = "green";
    for (const [rect, image] of this.#targetTiles(
      this.#target.div(this.boundingRectangle.size),
      size.y * zoom,
    )) {
      if (image) {
        ctx.drawImage(image, ...rect.mul(this.boundingRectangle.size).tuple);
      } else {
        ctx.fillRect(...rect.mul(this.boundingRectangle.size).tuple);
      }
    }
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
