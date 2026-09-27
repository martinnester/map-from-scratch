import { Rectangle, Vec2d } from "./geometry.js";

/**
 * @template T
 * @typedef {{
 *  readonly name: string,
 *  readonly element: HTMLElement,
 *  readonly value: T,
 * }} ViewControl
 */

/**
 * @implements {ViewControl<number>}
 */
export class ViewIntControl {
  /** @readonly @type {HTMLInputElement} */ element;
  /** @readonly @type {string} */ name;

  /**
   * @param {string} name
   * @param {number} initialValue
   * @param {number} min
   * @param {number} max
   */
  constructor(
    name,
    initialValue = 0,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
  ) {
    this.name = name;
    this.element = document.createElement("input");
    this.element.type = "number";
    this.element.value = String(initialValue);
    if (min !== Number.NEGATIVE_INFINITY) {
      this.element.min = String(min);
    }
    if (max !== Number.POSITIVE_INFINITY) {
      this.element.max = String(max);
    }
  }

  get value() {
    return parseInt(this.element.value);
  }
}

/**
 * @template T
 * @implements {ViewControl<T>}
 */
export class ViewOutput {
  /** @readonly @type {HTMLSpanElement} */ element;
  /**
   * @param {T} newValue
   */
  set value(newValue) {
    this.element.innerText = JSON.stringify(newValue);
  }
  /**
   * @param {string} name
   * @param {T} initialValue
   */
  constructor(name, initialValue) {
    this.name = name;
    this.element = document.createElement("span");
    this.value = initialValue;
  }
  get value() {
    return JSON.parse(this.element.innerText);
  }
}

/**
 * @template {string} T
 * @implements {ViewControl<T>}
 */
export class ViewSelectControl {
  /** @readonly @type {Set<T>} */ options;
  /** @readonly @type {HTMLSelectElement} */ element;
  /** @readonly @type {string} */ name;

  /**
   * @param {string} name
   * @param {[T, ...T[]]} options
   */
  constructor(name, options) {
    this.name = name;
    this.options = new Set(options);
    this.element = document.createElement("select");
    this.element.value = options[0];
    options.forEach((option) => {
      const el = document.createElement("option");
      el.value = option;
      el.innerText = option;
      this.element.appendChild(el);
    });
  }
  /**
   * @type {T}
   */
  get value() {
    //@ts-ignore
    return this.element.value;
  }
  /**
   * @param {()=>void} callback
   */
  subscribe(callback) {
    this.element.addEventListener("input", callback);
  }
}

export class Mouse extends Vec2d {
  /**  @readonly @type {boolean} */
  get down() {
    return this.#getMouseDown();
  }
  /** @readonly @type {()=>boolean} */ #getMouseDown;
  /**
   * @param {Vec2d} pos
   * @param {()=>boolean} getMouseDown
   */
  constructor(pos, getMouseDown) {
    super(pos.x, pos.y);
    this.#getMouseDown = getMouseDown;
  }
}

/**
 * @typedef {{
 *  readonly controls: ViewControl<any>[],
 *  readonly name: string,
 *  render(ctx: CanvasRenderingContext2D, mouse: Mouse, pan: Vec2d, zoom: number): void,
 *  readonly boundingRectangle: Rectangle,
 * }} ViewElement
 */

/**
 * 2d viewer with panning and zoom.
 */
export class View {
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  /** @type {HTMLElement} */
  #root;
  /** @type {HTMLElement} */
  #controlsRoot;
  /** @type {Map<ViewElement,HTMLDivElement>} */
  #children;
  /** @type {Vec2d} */
  #pan;
  /** @type {Vec2d} */
  #mousePos;
  /** @type {boolean} */
  #mouseDown;
  /** @type {number} */
  #zoom;

  /**
   *
   * @param {HTMLElement} root root element to mount view in
   */
  constructor(root) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("CanvasRenderingContext2D not available");
    }
    this.#ctx = ctx;

    this.#root = root;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    this.#root.appendChild(canvas);

    this.#children = new Map();

    this.#controlsRoot = document.createElement("div");
    this.#controlsRoot.style.position = "absolute";
    this.#controlsRoot.style.left = "0";
    this.#controlsRoot.style.top = "0";
    this.#root.appendChild(this.#controlsRoot);

    this.#zoom = 1;
    this.#mouseDown = false;
    this.#mousePos = new Vec2d(0, 0);
    this.#root.addEventListener("mousemove", (e) => {
      const { x, y } = root.getBoundingClientRect();
      this.#mousePos.x = e.x - x;
      this.#mousePos.y = e.y - y;
    });
    canvas.addEventListener("mousedown", () => {
      this.#mouseDown = true;
    });
    canvas.addEventListener("mouseup", () => {
      this.#mouseDown = false;
    });
    this.#root.addEventListener("wheel", (e) => {
      e.preventDefault();
      const { x, y } = root.getBoundingClientRect();
      this.#mousePos.x = e.x - x;
      this.#mousePos.y = e.y - y;

      if (e.ctrlKey || e.metaKey) {
        const scalar = 1.001 ** -e.deltaY;
        this.#zoom *= scalar;
        this.#pan.x -= (scalar - 1) * (this.#mousePos.x - this.#pan.x);
        this.#pan.y -= (scalar - 1) * (this.#mousePos.y - this.#pan.y);
      } else {
        this.#pan.x -= e.shiftKey ? e.deltaY : e.deltaX;
        this.#pan.y -= e.shiftKey ? 0 : e.deltaY;
      }
      if (this.#zoom < 1) {
        this.#zoom = 1;
        return;
      }
    });

    const resizeObserver = new ResizeObserver(() => this.#resize());
    resizeObserver.observe(root);
    this.#resize();
    this.#pan = new Vec2d(0, 0);
    requestAnimationFrame(() => this.#render());
  }
  /**
   * @param {ViewElement} element
   */
  appendChild(element) {
    this.#pan = new Vec2d(
      this.#ctx.canvas.width / window.devicePixelRatio / 2 -
        element.boundingRectangle.size.x / 2,
      this.#ctx.canvas.height / window.devicePixelRatio / 2 -
        element.boundingRectangle.size.y / 2,
    );
    const container = document.createElement("div");
    this.#children.set(element, container);
    container.innerHTML = `<div><strong>${element.name}:</strong></div>`;
    element.controls.forEach((control) => {
      const div = document.createElement("div");
      const label = document.createElement("label");
      label.innerText = `${control.name}: `;
      div.appendChild(label);
      div.appendChild(control.element);
      container.appendChild(div);
    });
    container.style.backgroundColor = "rgba(250,250,250,0.5)";
    container.style.backdropFilter = "blur(20px)";
    container.style.padding = "0.5em";
    container.style.border = "1px solid black";
    this.#controlsRoot.appendChild(container);
  }
  /**
   * @param {ViewElement} element
   */
  removeChild(element) {
    this.#children.get(element)?.remove();
    this.#children.delete(element);
    element.controls.forEach((control) => {
      this.#controlsRoot.removeChild(control.element);
    });
  }

  #resize() {
    this.#ctx.canvas.width = this.#root.clientWidth * window.devicePixelRatio;
    this.#ctx.canvas.height = this.#root.clientHeight * window.devicePixelRatio;
  }

  #render() {
    this.#ctx.clearRect(0, 0, this.#ctx.canvas.width, this.#ctx.canvas.height);
    this.#ctx.save();
    this.#ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.#ctx.translate(this.#pan.x, this.#pan.y);
    this.#ctx.scale(this.#zoom, this.#zoom);

    if (this.#children) {
      this.#children.forEach((_, child) => {
        this.#ctx.save();
        child.render(
          this.#ctx,
          new Mouse(
            this.#mousePos.sub(this.#pan).scale(1 / this.#zoom),
            () => this.#mouseDown,
          ),
          this.#pan,
          this.#zoom,
        );
        this.#ctx.restore();
      });
    }
    this.#ctx.restore();
    requestAnimationFrame(() => this.#render());
  }
}
