/** @import {ViewElement, ViewControl, Mouse} from "./view.js" */
import {View} from './view.js'

import { Rectangle, Vec2d } from "./geometry.js";
const GOOGLE_MAPS_API_KEY = localStorage.getItem('api-key') ?? prompt('enter google maps api key');
if(GOOGLE_MAPS_API_KEY) {
    localStorage.setItem('api-key', GOOGLE_MAPS_API_KEY);
}

// const root = /** @type {HTMLDivElement} */ (document.getElementById('root'));


/** @typedef {{session: string, expiry: string, tileWidth: number, imageFormat: "jpeg" | string, tileHeight:number}} TileSession */
      const view = new View(
        /** @type {HTMLDivElement} */ (document.getElementById("root")),
      );



/**
 * @implements {ViewElement}
 */
class Map {
    #TILE_SIZE = 500
    #BLANK = new Image();
    #OFFSETS = [
        new Vec2d(0,0),
        new Vec2d(1,0),
        new Vec2d(1,1),
        new Vec2d(0,1),
        new Vec2d(-1,1),
        new Vec2d(-1,0),
        new Vec2d(-1,-1),
        new Vec2d(0,-1),
        new Vec2d(1,-1),
    ]
    controls = /** @type {ViewControl<any>[]} */ ([]);
    name = "Map"
    /** @readonly @type {Record<string, HTMLImageElement | null>} */ #images;
    /** @type {Vec2d | null} */ #mapPan = null;
    /** @type {number | null} */ #mapZoom = null;
    /** @type {TileSession} */ #session ;
    /**
     * @param {TileSession} session
     */
    constructor(session){
        this.#session = session;
        this.#images = {};

}
#updateTiles(){
            for(const [key,pos] of this.#tileKeys()) {
                console.log(key)
                if(!(key in this.#images)) {
                    
                    const image = new Image();
                    image.src = `https://tile.googleapis.com/v1/2dtiles/${key}?session=${this.#session.session}&key=${GOOGLE_MAPS_API_KEY}`;
                    console.log(image)
                    this.#images[key] = image;
                }
            }
}
*#tileKeys() {
for(const offset of this.#OFFSETS) {
    if(this.#mapPan !== null && this.#mapZoom !== null) {
            const pos = this.#mapPan.add(offset);
            const size = Math.pow(2,this.#mapZoom);
            if(pos.bounded(new Vec2d(size,size))){
                            yield /** @type {[string,Vec2d]} */ ([`${this.#mapZoom}/${pos.x}/${pos.y}`,pos]);

            }
    }
        }
}
/**
 * 
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Mouse} mouse 
 * @param {Vec2d} pan
 * @param {number} zoom
 */
    render(ctx, mouse, pan, zoom) {
        const newMapZoom = Math.floor(Math.log2(zoom));
        // console.log(zoom,newMapZoom)
        // console.log(pan.scale(1/zoom))
        const currentTileSize = this.#TILE_SIZE/Math.pow(2,newMapZoom );
        const newMapPan = pan.scale(1/zoom).scale(1/currentTileSize).add(new Vec2d(0.5,0.5)).floor();
        if((this.#mapPan === null || this.#mapZoom === null || !this.#mapPan.equals(newMapPan) || this.#mapZoom !== newMapZoom)) {
        this.#mapZoom = newMapZoom;
        this.#mapPan = newMapPan.scale(-1);
         this.#updateTiles();
        }


        for(const [key,pos] of this.#tileKeys()) {
            const image = this.#images[key];
            ctx.drawImage(image?? this.#BLANK,...pos.scale(currentTileSize).tuple,currentTileSize,currentTileSize)
        }
    }
    boundingRectangle = new Rectangle(new Vec2d(0,0), new Vec2d(500,500));

}


const sessionString = localStorage.getItem('session');
let session = sessionString && JSON.parse(sessionString);
if(!session) {
          /**@type {TileSession} */
      fetch(`https://tile.googleapis.com/v1/createSession?key=${GOOGLE_MAPS_API_KEY}`, {
        method: 'POST',
        body: JSON.stringify({
            "mapType": "satellite",
            "language": "en-US",
            "region": "US"
        }),
      }).then(async x=>{
        const res = /** @type {TileSession} */  (await x.json());
        localStorage.setItem('session', JSON.stringify(res));
        session = res;
        console.log(session)
      })
} else {
view.appendChild(new Map(session))
}
// const canvas = document.createElement('canvas');

// canvas.width = 500;
// canvas.height = 500;
// canvas.style.border = '10px solid red';

// root.appendChild(canvas);

// const ctx = canvas.getContext('2d');
// if(!ctx) {
//     throw new Error('no canvas context!');
// }
