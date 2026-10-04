/**
 * @param {number} n
 * @param {number} d
 * @returns {number}
 */
function mod(n, d) {
  return ((n % d) + d) % d;
}

export class Matrix {
  /**@readonly @type {Vec2d} */ #iHat; // where to project x value
  /**@readonly @type {Vec2d} */ #jHat; // where to project y value
  /**@readonly @type {Vec2d} */ #translation;

  /**
   * @param {Vec2d} iHat
   * @param {Vec2d} jHat
   * @param {Vec2d} [translation]
   */
  constructor(iHat, jHat, translation = new Vec2d(0, 0)) {
    this.#iHat = iHat;
    this.#jHat = jHat;
    this.#translation = translation;
  }

  /**
   *
   * @param {Vec2d} that
   * @param {number} [w]
   * @returns {Vec2d}
   */
  multV(that, w) {
    const res = this.#iHat
      .scale(that.x)
      .add(this.#jHat.scale(that.y))
      .add(this.#translation.scale(that.w));
    if (w !== undefined) {
      res.w = w;
    }
    return res;
  }

  /**
   *
   * @param {Matrix} that
   * @returns {Matrix}
   */
  multM(that) {
    return new Matrix(
      this.multV(that.#iHat, 0),
      this.multV(that.#jHat, 0),
      this.multV(that.#translation),
    );
  }

  /**
   * @returns {[number,number,number,number,number,number]}
   */
  get tuple() {
    return [
      this.#iHat.x,
      this.#iHat.y,
      this.#jHat.x,
      this.#jHat.y,
      this.#translation.x,
      this.#translation.y,
    ];
  }

  /**
   * @param {number} radians
   * @returns {Matrix}
   */
  static rotation(radians) {
    return new Matrix(
      new Vec2d(Math.cos(radians), Math.sin(radians), 0),
      new Vec2d(-Math.sin(radians), Math.cos(radians), 0),
    );
  }
  /**
   * @param {number} amount
   * @returns {Matrix}
   */
  static scale(amount) {
    return new Matrix(new Vec2d(amount, 0, 0), new Vec2d(0, amount, 0));
  }
  /**
   * @param {Vec2d} amount
   * @returns {Matrix}
   */
  static translation(amount) {
    return new Matrix(new Vec2d(1, 0, 0), new Vec2d(0, 1, 0), amount);
  }
  static indentity() {
    return new Matrix(
      new Vec2d(1, 0, 0),
      new Vec2d(0, 1, 0),
      new Vec2d(0, 0, 1),
    );
  }
  /**
   * Calculates the inverse of this affine matrix.
   * @returns {Matrix}
   * @throws {Error} If the matrix is singular (determinant is 0).
   */
  inverse() {
    const ix = this.#iHat.x,
      iy = this.#iHat.y;
    const jx = this.#jHat.x,
      jy = this.#jHat.y;
    const tx = this.#translation.x,
      ty = this.#translation.y;

    // Calculate determinant of the 2x2 linear component
    const det = ix * jy - iy * jx;

    if (det === 0) {
      throw new Error("Matrix is singular and cannot be inverted.");
    }

    const invDet = 1 / det;

    // Inverse linear basis vectors
    const invIHat = new Vec2d(jy * invDet, -iy * invDet, 0);
    const invJHat = new Vec2d(-jx * invDet, ix * invDet, 0);

    // Inverse translation: -A^(-1) * t
    const invTx = -(invIHat.x * tx + invJHat.x * ty);
    const invTy = -(invIHat.y * tx + invJHat.y * ty);
    const invTranslation = new Vec2d(invTx, invTy, 1);

    return new Matrix(invIHat, invJHat, invTranslation);
  }
}

export class Vec2d {
  /** @type {number} */ x;
  /** @type {number} */ y;
  /** @type {number} */ w;

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [w]
   */
  constructor(x, y, w = 1) {
    this.x = x;
    this.y = y;
    this.w = w;
  }

  /**
   * @param {Vec2d} that
   * @returns {Vec2d}
   */
  add(that) {
    return new Vec2d(this.x + that.x, this.y + that.y, this.w + that.w);
  }
  /**
   * @param {number} amount
   * @returns {Vec2d}
   */
  scale(amount) {
    return new Vec2d(this.x * amount, this.y * amount, this.w);
  }
  /**
   * @param {Vec2d} that
   * @returns {Vec2d}
   */
  mul(that) {
    return new Vec2d(this.x * that.x, this.y * that.y, this.w * that.w);
  }
  /**
   * @param {Vec2d} that
   * @returns {Vec2d}
   */
  div(that) {
    return new Vec2d(this.x / that.x, this.y / that.y, this.w / that.w);
  }
  /**
   * @returns {Vec2d}
   */
  floor() {
    return new Vec2d(
      Math.floor(this.x),
      Math.floor(this.y),
      Math.floor(this.w),
    );
  }
  /**
   * @returns {Vec2d}
   */
  ceil() {
    return new Vec2d(Math.ceil(this.x), Math.ceil(this.y), Math.ceil(this.w));
  }
  /**
   * @param {Vec2d} that
   * @returns {Vec2d}
   */
  sub(that) {
    return new Vec2d(this.x - that.x, this.y - that.y, this.w - that.w);
  }
  /**
   * @param {Vec2d} size
   * @returns {boolean}
   */
  bounded(size) {
    //     return this.x >= 0 && this.y >= 0 && this.w>=0 && this.x < size.x && this.y < size.y && this.w < size.w;
    return this.x >= 0 && this.y >= 0 && this.x < size.x && this.y < size.y;
  }
  /**
   * @param {Vec2d} that
   * @returns {Vec2d}
   */
  maximums(that) {
    return new Vec2d(Math.max(this.x, that.x), Math.max(this.y, that.y));
  }
  /**
   * @param {Vec2d} that
   * @returns {Vec2d}
   */
  minimums(that) {
    return new Vec2d(Math.min(this.x, that.x), Math.min(this.y, that.y));
  }
  key() {
    return `${this.x},${this.y}`;
  }
  /**
   * @param {Vec2d} that
   * @returns {Vec2d}
   */
  mod(that) {
    return new Vec2d(mod(this.x, that.x), mod(this.y, that.y));
  }
  /**
   * @returns {[number, number]}
   */
  get tuple() {
    return [this.x, this.y];
  }
  /**
   * @param {Vec2d} that
   * @returns {boolean}
   */
  equals(that) {
    return this.x === that.x && this.y === that.y;
  }
  magnitude() {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }
  angle() {
    return Math.atan(this.y / this.x);
  }
}

export class Rectangle {
  /** @readonly @type {Vec2d} */ position;
  /** @readonly @type {Vec2d} */ size;

  /**
   * @param {Vec2d} position
   * @param {Vec2d} size
   */
  constructor(position, size) {
    this.position = position;
    this.size = size;
  }
  /**
   * @param {Vec2d} pos
   * @returns {boolean}
   */
  contains(pos) {
    return (
      pos.x >= this.position.x &&
      pos.y >= this.position.y &&
      pos.x < this.position.x + this.size.x &&
      pos.y < this.position.y + this.size.y
    );
  }
  /**
   * @param {Vec2d} that
   * @returns {Rectangle}
   */
  div(that) {
    return new Rectangle(this.position.div(that), this.size.div(that));
  }
  /**
   * @param {Vec2d} that
   * @returns {Rectangle}
   */
  mul(that) {
    return new Rectangle(this.position.mul(that), this.size.mul(that));
  }
  /**
   * @param {number} amount
   * @returns {Rectangle}
   */
  scale(amount) {
    return new Rectangle(this.position.scale(amount), this.size.scale(amount));
  }
  /**
   * @param {Rectangle} that
   * @returns {Rectangle}
   */
  clamp(that) {
    const max = this.position.maximums(that.position);
    return new Rectangle(
      max,
      this.position
        .add(this.size)
        .minimums(that.position.add(that.size))
        .sub(max),
    );
  }
  *points() {
    for (let X = this.position.x; X < this.position.x + this.size.x; X++) {
      for (let Y = this.position.y; Y < this.position.y + this.size.y; Y++) {
        yield new Vec2d(X, Y);
      }
    }
  }
  /**
   * @returns {[number, number, number, number]}
   */
  get tuple() {
    return [...this.position.tuple, ...this.size.tuple];
  }
}
