import { TileType, MapType } from '../../common/interfaces';
import { rect } from '../../common/rect';
import { createServerMap, setTile, snapshotTiles } from '../serverMap';
import { World, goToMap } from '../world';
import * as entities from '../../common/entities';
import { createSignWithText } from '../controllerUtils';
import { setEntityName } from '../entityUtils';
import { deserializeTiles } from '../../common/compress';
import * as fs from 'fs';
import { pathTo } from '../paths';

const testMapData = JSON.parse(fs.readFileSync(pathTo('src', 'maps', 'testMap.json'), 'utf8')) as {
	width: number;
	height: number;
	tiles: string;
};

export function createTestMap(_world: World) {
	// size: 21 by 21 regions -> 168 by 168 tiles
	const map = createServerMap('New main map', MapType.None, 21, 21, TileType.Grass);
	const decodedTiles = deserializeTiles(testMapData.tiles);

	for (let i = 0; i < decodedTiles.length; i++) {
		const x = i % testMapData.width;
		const y = Math.floor(i / testMapData.width);
		setTile(map, x, y, decodedTiles[i]);
	}

	snapshotTiles(map);

	// place default spawn point at the center of the map
	map.spawnArea = rect(map.width / 2, map.height / 2, 0, 0);

	// shorthand for adding entities
	function add(entity: any) {
		return _world.addEntity(entity, map);
	}

	// exit to the main map
	add(entities.trigger3x1(84, 84.33333333333333)).trigger = (_entity: any, client: any) => goToMap(_world, client, 'main');
	add(createSignWithText(
		84, 83, 'Exit to main', 'Подойдите к этой табличке, чтобы вернуться на спавн.', entities.signQuestion,
	));

	// cave-cover decorations around the trigger exit
	add(entities.caveCover(83.33333333333333, 84));
	add(entities.caveCover(83.33333333333333, 84.66666666666667));
	add(entities.caveCover(84, 84.66666666666667));
	add(entities.caveCover(84, 84));

	const savedEntities: { type: string; x: number; y: number; state?: number; options?: any; name?: string }[] = [
		{ type: 'sign', x: 99.75, y: 95.08333333333333, options: { name: 'кафе', customSignMessage: 'громадное :0' }, name: 'кафе' },
		{ type: 'sign', x: 64.40625, y: 131.08333333333334, options: { name: 'площадка', customSignMessage: '', seasonOverride: 2 }, name: 'площадка' },
		{ type: 'sign', x: 87.625, y: 133.25, options: { name: '"регистрационная"', customSignMessage: 'тут временно пока нет дома' }, name: '"регистрационная"' },
		{ type: 'large-leafed-bush-3', x: 76.6875, y: 151.875, state: 8 },
		{ type: 'bush-heart', x: 77.125, y: 151.75, state: 8 },
		{ type: 'stone-wall-pole-1', x: 85.65625, y: 151.375 },
		{ type: 'stone-wall-pole-1', x: 85.65625, y: 150.33333333333334 },
		{ type: 'stone-wall-pole-1', x: 85.65625, y: 149.29166666666666 },
		{ type: 'stone-wall-pole-1', x: 81.625, y: 151.08333333333334 },
		{ type: 'stone-wall-pole-1', x: 81.625, y: 150 },
		{ type: 'stone-wall-pole-1', x: 81.625, y: 148.95833333333334 },
		{ type: 'stone-wall-pole-1', x: 85.40625, y: 148.5 },
		{ type: 'stone-wall-pole-1', x: 85.09375, y: 148.16666666666666 },
		{ type: 'stone-wall-pole-1', x: 84.75, y: 147.91666666666666 },
		{ type: 'stone-wall-pole-1', x: 84.375, y: 147.75 },
		{ type: 'stone-wall-pole-1', x: 84, y: 147.70833333333334 },
		{ type: 'stone-wall-pole-1', x: 83.59375, y: 147.625 },
		{ type: 'stone-wall-pole-1', x: 83.1875, y: 147.66666666666666 },
		{ type: 'stone-wall-pole-1', x: 81.8125, y: 148.66666666666666 },
		{ type: 'stone-wall-pole-1', x: 82.03125, y: 148.375 },
		{ type: 'stone-wall-pole-1', x: 82.34375, y: 148.08333333333334 },
		{ type: 'stone-wall-pole-1', x: 82.59375, y: 147.875 },
		{ type: 'stone-wall-pole-1', x: 82.8125, y: 147.75 },
		{ type: 'stone-wall-pole-1', x: 85.59375, y: 148.79166666666666 },
		{ type: 'berry-bush', x: 87.84375, y: 151.16666666666666 },
		{ type: 'spider', x: 85.125, y: 150.29166666666666, state: 8, options: { height: 20, time: 0 } },
		{ type: 'sign', x: 51.1875, y: 154.89583333333334, options: { name: 'пикник', customSignMessage: '' }, name: 'пикник' },
		{ type: 'large-leafed-bush-2', x: 74.875, y: 155.83333333333334 },
		{ type: 'large-leafed-bush-3', x: 74.21875, y: 156.41666666666666 },
		{ type: 'bench-1', x: 77.3125, y: 155.70833333333334 },
		{ type: 'bench-seat-h', x: 74.40625, y: 158.91666666666666 },
		{ type: 'large-leafed-bush-3', x: 78.6875, y: 155.58333333333334 },
		{ type: 'rock', x: 78.21875, y: 155.41666666666666 },
		{ type: 'tree5-stump-0', x: 79.25, y: 152.08333333333334 },
		{ type: 'large-leafed-bush-3', x: 77, y: 155.125, state: 8 },
		{ type: 'large-leafed-bush-3', x: 76.28125, y: 155.45833333333334, state: 8 },
		{ type: 'tree1-0', x: 78.40625, y: 155.91666666666666, state: 8 },
		{ type: 'tree1-0', x: 76.375, y: 155.875, state: 8 },
		{ type: 'stone-wall-pole-1', x: 85.65625, y: 152.41666666666666 },
		{ type: 'stone-wall-pole-1', x: 81.625, y: 152.125 },
		{ type: 'spider', x: 85.96875, y: 152.91666666666666, options: { height: 20, time: 0 } },
		{ type: 'rock-3', x: 81, y: 152.58333333333334 },
		{ type: 'pine1', x: 86, y: 152.20833333333334 },
		{ type: 'pine1', x: 81.375, y: 152.25 },
		{ type: 'berry-bush', x: 85.78125, y: 152.79166666666666 },
		{ type: 'bush-heart', x: 81.0625, y: 152.25 },
		{ type: 'bush-heart', x: 87.5, y: 154.625 },
		{ type: 'large-leafed-bush-3', x: 87.0625, y: 153.95833333333334 },
		{ type: 'large-leafed-bush-2', x: 80.15625, y: 154.08333333333334, state: 8 },
		{ type: 'rock-3', x: 86.28125, y: 152.75, state: 8 },
		{ type: 'rock-3', x: 87.4375, y: 155.41666666666666, state: 8 },
		{ type: 'rock-3', x: 80.15625, y: 153.58333333333334, state: 8 },
		{ type: 'water-rock-10', x: 80, y: 153.29166666666666 },
		{ type: 'water-rock-7', x: 87.5, y: 153.625 },
		{ type: 'tree3-0', x: 86.5, y: 153.375 },
		{ type: 'tree1-0', x: 84.78125, y: 153.04166666666666 },
		{ type: 'berry-bush', x: 87.78125, y: 154.875 },
		{ type: 'poof', x: 89.28125, y: 155.08333333333334 },
		{ type: 'basket-bin', x: 88.59375, y: 154.29166666666666 },
		{ type: 'rock-2', x: 88.03125, y: 155.83333333333334 },
		{ type: 'crate-2a', x: 89.25, y: 155.29166666666666 },
		{ type: 'large-leafed-bush-1', x: 88.9375, y: 155.66666666666666 },
		{ type: 'tree1-0', x: 90.46875, y: 152.66666666666666, state: 8 },
		{ type: 'rock-3', x: 90.90625, y: 154.66666666666666, state: 8 },
		{ type: 'rock-2', x: 91.875, y: 155.625, state: 8 },
		{ type: 'rock-2', x: 91.625, y: 155.91666666666666, state: 8 },
		{ type: 'rock-2', x: 91.9375, y: 155.79166666666666, state: 8 },
		{ type: 'rock-2', x: 91.625, y: 155.54166666666666, state: 8 },
		{ type: 'rock-2', x: 92.03125, y: 155.66666666666666, state: 8 },
		{ type: 'rock-2', x: 92.3125, y: 156.16666666666666, state: 8 },
		{ type: 'rock-3', x: 91.84375, y: 155.45833333333334, state: 8 },
		{ type: 'bench-back', x: 77.15625, y: 164 },
		{ type: 'bench-seat', x: 77.15625, y: 163.125 },
		{ type: 'bench-back-h', x: 73.90625, y: 161.625 },
	];

	const savedEntityFactories: Record<string, (x: number, y: number, options?: any) => any> = {
		'cave-cover': entities.caveCover,
		'sign': entities.sign,
		'large-leafed-bush-3': entities.largeLeafedBush3,
		'bush-heart': entities.bushHeart,
		'stone-wall-pole-1': entities.stoneWallPole1,
		'berry-bush': entities.berryBush,
		'spider': entities.spider,
		'large-leafed-bush-2': entities.largeLeafedBush2,
		'bench-1': entities.bench1,
		'bench-seat-h': entities.benchSeatH,
		'rock': entities.rock,
		'tree5-stump-0': entities.tree5Stump,
		'tree1-0': entities.tree1,
		'rock-3': entities.rock3,
		'water-rock-10': entities.waterRock10,
		'water-rock-7': entities.waterRock7,
		'tree3-0': entities.tree3,
		'pine1': entities.pine1,
		'poof': entities.poof,
		'basket-bin': entities.basketBin,
		'rock-2': entities.rock2,
		'crate-2a': entities.crate2A,
		'large-leafed-bush-1': entities.largeLeafedBush1,
		'bench-back': entities.benchBack,
		'bench-seat': entities.benchSeat,
		'bench-back-h': entities.benchBackH,
	};

	for (const item of savedEntities) {
		const entityItem = item as any;
		const factory = savedEntityFactories[entityItem.type];
		if (!factory) {
			console.warn(`Unknown saved entity type in TestMap: ${entityItem.type}`);
			continue;
		}

		if (entityItem.type === 'sign') {
			const signText = entityItem.options && typeof entityItem.options.customSignMessage === 'string' ? entityItem.options.customSignMessage : '';
			const sign = createSignWithText(entityItem.x, entityItem.y, entityItem.name || 'Sign', signText, entities.sign);
			if (entityItem.options) {
				const signOptions = { ...(sign.options || {}), ...entityItem.options } as any;
				delete signOptions.name;
				sign.options = signOptions;
			}
			if (entityItem.name) {
				setEntityName(sign, entityItem.name);
			}
			add(sign);
			continue;
		}

		const entity = factory(entityItem.x, entityItem.y, entityItem.options || {});
		if (entityItem.state !== undefined) {
			entity.state = entityItem.state;
		}
		if (entityItem.name) {
			setEntityName(entity, entityItem.name);
		}
		add(entity);
	}

	return map;
}
