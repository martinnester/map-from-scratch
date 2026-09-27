/**
 * @param {number} n
 * @param {number} d
 * @returns {number}
 */
function mod(n, d) {
  return ((n % d) + d) % d;
}

export class Vec2d {
  /** @type {number} */ x;
  /** @type {number} */ y;

  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * @param {Vec2d} that
   * @returns {Vec2d}
   */
  add(that) {
    return new Vec2d(this.x + that.x, this.y + that.y);
  }
  /**
   * @param {number} amount
   * @returns {Vec2d}
   */
  scale(amount) {
    return new Vec2d(this.x * amount, this.y * amount);
  }
  /**
   * @returns {Vec2d}
   */
  floor() {
    return new Vec2d(Math.floor(this.x), Math.floor(this.y));
  }
  /**
   * @param {Vec2d} that
   * @returns {Vec2d}
   */
  sub(that) {
    return new Vec2d(this.x - that.x, this.y - that.y);
  }
  /**
   * @param {Vec2d} size
   * @returns {boolean}
   */
  bounded(size) {
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
  /**
   * @returns {[number, number, number, number]}
   */
  get tuple() {
    return [...this.position.tuple, ...this.size.tuple];
  }
}
