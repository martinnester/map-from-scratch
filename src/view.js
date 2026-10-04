import { Matrix, Rectangle, Vec2d } from "./geometry.js";

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
 *  render(ctx: CanvasRenderingContext2D, mouse: Mouse, transform: Matrix, size: Vec2d): void,
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
  #mousePos;
  /** @type {boolean} */
  #mouseDown;
  /** @type {Vec2d} */
  #size;
  /** @type {Matrix} */
  #transform = Matrix.indentity()
    .multM(Matrix.rotation(Math.PI * 1.7))
    .multM(Matrix.scale(2));
  /** @type {PointerEvent[]} */
  #pointerMoveEvents = [];

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

    window.addEventListener("pointermove", (e) => {
      this.#mousePos = this.#screenToWorld(new Vec2d(e.x, e.y));
    });

    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
    });
    const pointersDown = /**@type {Set<number>} */ (new Set());
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      pointersDown.add(e.pointerId);
    });
    window.addEventListener("pointermove", (e) => {
      if (pointersDown.has(e.pointerId)) {
        this.#pointerMoveEvents.push(e);
        this.#pointerMoveEvents.sort((a, b) => a.pointerId - b.pointerId);
      }
    });
    window.addEventListener("pointerup", (e) => {
      pointersDown.delete(e.pointerId);
    });

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

    this.#mouseDown = false;
    this.#mousePos = new Vec2d(0, 0);
    this.#root.addEventListener("wheel", (e) => {
      e.preventDefault();
      const scalar = 1.001 ** -e.deltaY;
      this.#transform = this.#transform
        .multM(Matrix.translation(this.#mousePos))
        .multM(Matrix.scale(scalar))
        .multM(Matrix.translation(this.#mousePos.scale(-1)));
      console.log(...this.#transform.tuple);
    });

    const resizeObserver = new ResizeObserver(() => this.#resize());
    resizeObserver.observe(root);
    this.#resize();
    this.#size = new Vec2d(
      this.#ctx.canvas.width / window.devicePixelRatio, // / this.#zoom,
      this.#ctx.canvas.height / window.devicePixelRatio, // / this.#zoom,
    );

    requestAnimationFrame(() => this.#render());
  }
  /**
   * @param {Vec2d} screen
   * @returns {Vec2d}
   */
  #screenToWorld(screen) {
    const { x, y } = this.#root.getBoundingClientRect();
    return this.#transform.inverse().multV(screen.sub(new Vec2d(x, y, 0)));
  }
  /**
   * @param {ViewElement} element
   */
  appendChild(element) {
    const container = document.createElement("div");
    this.#children.set(element, container);
    if (element.controls.length === 0) {
      return;
    }
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
    if (this.#pointerMoveEvents) {
      const [first, second] = this.#pointerMoveEvents;
      if (first) {
        this.#transform = this.#transform.multM(
          Matrix.translation(
            this.#transform
              .inverse()
              .multV(new Vec2d(first.movementX, first.movementY, 0)),
          ),
        );
      }
      if (first && second) {
        // TODO: make this actually work well
        const firstPosWorld = this.#screenToWorld(new Vec2d(first.x, first.y));
        const secondPosScreen = new Vec2d(second.x, second.y);
        const a = this.#screenToWorld(
          secondPosScreen.sub(new Vec2d(second.movementX, second.movementY)),
        )
          .sub(firstPosWorld)
          .angle();
        const b = this.#screenToWorld(secondPosScreen)
          .sub(firstPosWorld)
          .angle();
        this.#transform = this.#transform
          .multM(Matrix.translation(firstPosWorld))
          .multM(Matrix.rotation(b - a))
          .multM(Matrix.translation(firstPosWorld.scale(-1)));
      }
      this.#pointerMoveEvents = [];
    }
    this.#ctx.clearRect(0, 0, this.#ctx.canvas.width, this.#ctx.canvas.height);
    this.#ctx.save();
    const matrix = Matrix.scale(window.devicePixelRatio).multM(
      this.#transform,
    ).tuple;
    if (!matrix.every(Number.isFinite)) {
      debugger;
    } else {
      this.#ctx.setTransform(...matrix);
    }

    if (this.#children) {
      this.#children.forEach((_, child) => {
        this.#ctx.save();
        child.render(
          this.#ctx,
          new Mouse(
            // this.#mousePos.sub(this.#pan).scale(1 / this.#zoom),
            this.#mousePos,
            () => this.#mouseDown,
          ),
          this.#transform,
          this.#size,
        );
        this.#ctx.restore();
      });
    }
    this.#ctx.beginPath();
    this.#ctx.arc(...this.#mousePos.tuple, 5, 0, 2 * Math.PI);
    this.#ctx.closePath();
    this.#ctx.fill();

    this.#ctx.restore();
    requestAnimationFrame(() => this.#render());
  }
}
