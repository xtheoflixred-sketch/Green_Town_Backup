import { fromByteArray, toByteArray } from 'base64-js';
import { Controller, ServerMap } from '../serverInterfaces';
import { World } from '../world';
import { Entity, TileType } from '../../common/interfaces';
import { tileHeight } from '../../common/constants';
import { array } from '../../common/utils';
import { Walls } from '../../common/entities';

const createGetAt = (width: number, height: number) => <T>(items: T[], x: number, y: number) => {
	return (x < 0 || y < 0 || x >= width || y >= height) ? undefined : items[x + y * width];
};

const createSetAt = (width: number, height: number) => <T>(items: T[], x: number, y: number, value: T) => {
	if (x >= 0 && y >= 0 && x < width && y < height) {
		items[x + y * width] = value;
	}
};

export class WallController implements Controller {
	top = 0;
	isTall = (_x: number, _y: number) => false;
	lockOuterWalls = false;
	private material: 'wood' | 'stone';
	private lockedTiles = new Set<string>();
	private forcedTallWalls = new Set<string>();
	private hWalls: (Entity | undefined)[];
	private vWalls: (Entity | undefined)[];
	constructor(world: World, map: ServerMap, woodWalls: Walls, stoneWalls: Walls, initialMaterial: 'wood' | 'stone' = 'wood') {
		const width = map.width + 1;
		const height = map.height + 1;

		const getAt = createGetAt(width, height);
		const setAt = createSetAt(width, height);

		const hWalls = this.hWalls = array<Entity | undefined>(width * height, undefined);
		const vWalls = this.vWalls = array<Entity | undefined>(width * height, undefined);
		const hMaterials = array<'wood' | 'stone' | undefined>(width * height, undefined);
		const vMaterials = array<'wood' | 'stone' | undefined>(width * height, undefined);
		const cWalls = array<Entity | undefined>(width * height, undefined);

		const yOffset = 3 / tileHeight;

		this.material = initialMaterial;
		let activeWalls = initialMaterial === 'stone' ? stoneWalls : woodWalls;
		const tallKey = (x: number, y: number, type: TileType.WallH | TileType.WallV) => `${x},${y}:${type}`;
		const isForcedTall = (x: number, y: number, type: TileType.WallH | TileType.WallV) => this.forcedTallWalls.has(tallKey(x, y, type));
		const getWallsForMaterial = (material: 'wood' | 'stone') => material === 'stone' ? stoneWalls : woodWalls;
		const getWallMaterial = (x: number, y: number, type: TileType.WallH | TileType.WallV) => {
			if (x < 0 || y < 0 || x >= width || y >= height) {
				return undefined;
			}

			return type === TileType.WallH ? hMaterials[x + y * width] : vMaterials[x + y * width];
		};
		const getCornerMaterial = (x: number, y: number) =>
			getWallMaterial(x, y, TileType.WallH)
			|| getWallMaterial(x - 1, y, TileType.WallH)
			|| getWallMaterial(x, y, TileType.WallV)
			|| getWallMaterial(x, y - 1, TileType.WallV)
			|| this.material;
		const isBaseTallHorizontalWall = (x: number, y: number) =>
			y <= this.top || this.isTall(x, y) || isForcedTall(x, y, TileType.WallH);
		const isTallHorizontalWall = (x: number, y: number) => {
			if (isBaseTallHorizontalWall(x, y)) {
				return true;
			}

			const hasLeft = !!getAt(hWalls, x - 1, y);
			const hasRight = !!getAt(hWalls, x + 1, y);

			if (hasLeft && hasRight) {
				const leftTall = isBaseTallHorizontalWall(x - 1, y);
				const rightTall = isBaseTallHorizontalWall(x + 1, y);

				if (leftTall === rightTall) {
					return leftTall;
				}
			}

			return false;
		};
		const hasTallHorizontalAt = (x: number, y: number) => !!getAt(hWalls, x, y) && isTallHorizontalWall(x, y);
		const hasTallHorizontalConnection = (x: number, y: number) =>
			hasTallHorizontalAt(x, y) || hasTallHorizontalAt(x - 1, y);
		const isBaseTallVerticalWall = (x: number, y: number) =>
			x === 0
			|| x === (width - 1)
			|| this.isTall(x, y)
			|| isForcedTall(x, y, TileType.WallV)
			|| hasTallHorizontalConnection(x, y)
			|| hasTallHorizontalConnection(x, y + 1);
		const isTallVerticalWall = (x: number, y: number) =>
			(() => {
				if (isBaseTallVerticalWall(x, y)) {
					return true;
				}

				const hasUp = !!getAt(vWalls, x, y - 1);
				const hasDown = !!getAt(vWalls, x, y + 1);

				if (hasUp && hasDown) {
					const upTall = isBaseTallVerticalWall(x, y - 1);
					const downTall = isBaseTallVerticalWall(x, y + 1);

					if (upTall === downTall) {
						return upTall;
					}
				}

				return false;
			})();
		const getHorizontalWallCtor = (x: number, y: number, material: 'wood' | 'stone') => {
			const { wallHShort, wallH, wallCutR, wallCutL } = getWallsForMaterial(material);

			if (isTallHorizontalWall(x, y)) {
				return wallH;
			}

			const hasTallLeft = x === 0 || isTallHorizontalWall(x - 1, y);
			const hasTallRight = x === (width - 2) || isTallHorizontalWall(x + 1, y);

			if (hasTallLeft !== hasTallRight) {
				return hasTallLeft ? wallCutL : wallCutR;
			}

			return wallHShort;
		};

		const addWall = (x: number, y: number, type: TileType.WallH | TileType.WallV, material: 'wood' | 'stone' = this.material) => {
			if (type === TileType.WallH) {
				const ctor = getHorizontalWallCtor(x, y, material);
				setAt(hWalls, x, y, world.addEntity(ctor(x + 0.5, y + yOffset), map));
				setAt(hMaterials, x, y, material);
			} else {
				const { wallVShort, wallV } = getWallsForMaterial(material);
				const ctor = isTallVerticalWall(x, y) ? wallV : wallVShort;
				setAt(vWalls, x, y, world.addEntity(ctor(x, y + 0.5), map));
				setAt(vMaterials, x, y, material);
			}
		};

		const clearAllWalls = () => {
			for (let i = 0; i < hWalls.length; i++) {
				if (hWalls[i]) {
					world.removeEntity(hWalls[i]!, map);
					hWalls[i] = undefined;
				}
				if (vWalls[i]) {
					world.removeEntity(vWalls[i]!, map);
					vWalls[i] = undefined;
				}
				if (cWalls[i]) {
					world.removeEntity(cWalls[i]!, map);
					cWalls[i] = undefined;
				}
			}
		};

		const rebuildWalls = () => {
			const hMask = hWalls.map(w => !!w);
			const vMask = vWalls.map(w => !!w);
			const hMaterialMask = hMaterials.slice();
			const vMaterialMask = vMaterials.slice();
			clearAllWalls();

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const i = x + y * width;
					if (hMask[i]) {
						addWall(x, y, TileType.WallH, hMaterialMask[i] || this.material);
					}
				}
			}

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const i = x + y * width;
					if (vMask[i]) {
						addWall(x, y, TileType.WallV, vMaterialMask[i] || this.material);
					}
				}
			}

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					updateCorner(x, y);
				}
			}
		};

		const calcCorner = (x: number, y: number) => {
			// top right bottom left
			return (getAt(vWalls, x, y - 1) ? 8 : 0)
				+ (getAt(hWalls, x, y) ? 4 : 0)
				+ (getAt(vWalls, x, y) ? 2 : 0)
				+ (getAt(hWalls, x - 1, y) ? 1 : 0);
		};

		const updateCorner = (x: number, y: number) => {
			if (x < 0 || y < 0 || x >= width || y >= height)
				return;

			const top = this.top;
			const isOutside = x === 0 || y <= top || x === map.width || this.isTall(x, y);
			const forcedTallConnection =
				(!!getAt(hWalls, x, y) && isForcedTall(x, y, TileType.WallH)) ||
				(!!getAt(hWalls, x - 1, y) && isForcedTall(x - 1, y, TileType.WallH)) ||
				(!!getAt(vWalls, x, y) && isForcedTall(x, y, TileType.WallV)) ||
				(!!getAt(vWalls, x, y - 1) && isForcedTall(x, y - 1, TileType.WallV));
			const { wallCorners, wallCornersShort } = getWallsForMaterial(getCornerMaterial(x, y));
			const corners = (isOutside || forcedTallConnection) ? wallCorners : wallCornersShort;
			const current = getAt(cWalls, x, y);
			const calc = calcCorner(x, y);

			if (!current || current.type !== corners[calc].type) {
				if (current) {
					world.removeEntity(current, map);
				}

				setAt(cWalls, x, y, calc ? world.addEntity(corners[calc](x, y + yOffset), map) : undefined);
			}
		};

		this.toggleWall = (x, y, type) => {
			this.toggleWallWithHeight!(x, y, type, false);
		};

		this.toggleWallWithHeight = (x, y, type, tall, material = this.material) => {
			if (x < 0 || y < 0 || x >= width || y >= height)
				return;

			if (this.lockedTiles.has(`${x},${y}:${type}`))
				return;

			const walls = type === TileType.WallH ? hWalls : vWalls;
			const entity = getAt(walls, x, y);
			const top = this.top;

			if (type === TileType.WallH && x === (width - 1))
				return;

			if (type === TileType.WallV && y === (height - 1))
				return;

			if (this.lockOuterWalls) {
				if (type === TileType.WallH && (y <= top || y === (width - 1)))
					return;
				if (type === TileType.WallV && (x === 0 || x === (height - 1) || y < top))
					return;
			}

			if (entity) {
				const wallTypeKey = tallKey(x, y, type as TileType.WallH | TileType.WallV);
				const currentIsForcedTall = isForcedTall(x, y, type as TileType.WallH | TileType.WallV);
				const currentMaterial = getWallMaterial(x, y, type as TileType.WallH | TileType.WallV);

				// Remove existing wall
				world.removeEntity(entity, map);
				setAt(walls, x, y, undefined);
				if (type === TileType.WallH) {
					setAt(hMaterials, x, y, undefined);
				} else {
					setAt(vMaterials, x, y, undefined);
				}
				this.forcedTallWalls.delete(wallTypeKey);

				if (currentIsForcedTall !== tall || currentMaterial !== material) {
					// Different height/material → replace
					if (tall) {
						this.forcedTallWalls.add(wallTypeKey);
					}
					addWall(x, y, type as TileType.WallH | TileType.WallV, material);
				}
				// Same height → just delete (no re-add)
				rebuildWalls();
			} else {
				if (tall) {
					this.forcedTallWalls.add(tallKey(x, y, type as TileType.WallH | TileType.WallV));
				} else {
					this.forcedTallWalls.delete(tallKey(x, y, type as TileType.WallH | TileType.WallV));
				}
				addWall(x, y, type as TileType.WallH | TileType.WallV, material);
				rebuildWalls();
			}

			updateCorner(x, y);
			updateCorner(x + 1, y);
			updateCorner(x, y + 1);
		};

		this.setWallMaterial = (material: 'wood' | 'stone') => {
			const nextWalls = material === 'stone' ? stoneWalls : woodWalls;
			if (nextWalls === activeWalls) {
				return;
			}

			this.material = material;
			activeWalls = nextWalls;
		};
	}
	initialize() {
	}
	update() {
	}
	getWallMaterial() {
		return this.material;
	}
	toggleWall?: (x: number, y: number, type: TileType) => void;
	toggleWallWithHeight?: (x: number, y: number, type: TileType, tall: boolean, material?: 'wood' | 'stone') => void;
	setWallMaterial?: (material: 'wood' | 'stone') => void;
	lockWall(x: number, y: number, type: TileType.WallH | TileType.WallV) {
		this.lockedTiles.add(`${x},${y}:${type}`);
	}
	serialize() {
		const data = new Uint8Array(Math.ceil(this.vWalls.length / 8) + Math.ceil(this.hWalls.length / 8));
		let offset = 0;

		for (let i = 0; i < this.vWalls.length; i += 8, offset++) {
			let value = 0;

			for (let j = 0; j < 8; j++) {
				if (this.vWalls[i + j]) {
					value |= (1 << j);
				}
			}

			data[offset] = value;
		}

		for (let i = 0; i < this.hWalls.length; i += 8, offset++) {
			let value = 0;

			for (let j = 0; j < 8; j++) {
				if (this.hWalls[i + j]) {
					value |= (1 << j);
				}
			}

			data[offset] = value;
		}

		return fromByteArray(data);
	}
	deserialize(width: number, height: number, serialized: string) {
		const data = toByteArray(serialized);
		const size = (width + 1) * (height + 1);
		let offset = 0;

		for (let i = 0; i < size; i += 8, offset++) {
			let value = data[offset];

			for (let j = 0; j < 8; j++) {
				if ((!!this.vWalls[i + j]) !== ((value & (1 << j)) !== 0)) {
					const x = (i + j) % (width + 1);
					const y = Math.floor((i + j) / (width + 1));
					this.toggleWall!(x, y, TileType.WallV);
				}
			}
		}

		for (let i = 0; i < size; i += 8, offset++) {
			let value = data[offset];

			for (let j = 0; j < 8; j++) {
				if ((!!this.hWalls[i + j]) !== ((value & (1 << j)) !== 0)) {
					const x = (i + j) % (width + 1);
					const y = Math.floor((i + j) / (width + 1));
					this.toggleWall!(x, y, TileType.WallH);
				}
			}
		}
	}
}
