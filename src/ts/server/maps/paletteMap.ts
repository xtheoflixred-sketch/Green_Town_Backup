import * as entities from '../../common/entities';
import { rect } from '../../common/rect';
import { TileType, MapType } from '../../common/interfaces';
import { createServerMap } from '../serverMap';
import { World, goToMap } from '../world';
import { allEntities } from '../api/account';
import { createSignWithText } from '../controllerUtils';
import { ServerEntity } from '../serverInterfaces';
import { setEntityName } from '../entityUtils';

export function createPaletteMap(world: World) {
	const map = createServerMap('palette', MapType.None, 10, 10, TileType.Grass);
	// Если когда-либо появится palette.json с flags, добавить аналогичное копирование:
	// if (typeof paletteMapData?.flags === 'number') map.flags |= paletteMapData.flags;

	map.spawnArea = rect(map.width / 2, map.height / 2, 0, 0);

	function add(entity: ServerEntity) {
		return world.addEntity(entity, map);
	}

	const exitX = map.width / 2;
	const exitY = map.height / 2 - 3;
	add(entities.trigger3x1(exitX, exitY)).trigger = (_entity: any, client: any) => goToMap(world, client, 'main');
	add(createSignWithText(
		exitX, exitY, 'Exit to main', 'Подойдите к этой табличке, чтобы вернуться на спавн.', entities.signDonate,
	));

	const pad = 5;
	let x = pad;
	let y = pad;

	for (const name of allEntities) {
		const entityOrEntities = (entities as any)[name](x, y);
		const ents = Array.isArray(entityOrEntities) ? entityOrEntities : [entityOrEntities];

		for (const entity of ents) {
			add(entity);
			setEntityName(entity, name);
		}

		x += 3;

		if (x > (map.width - pad)) {
			x = pad;
			y += 3;
		}
	}

	return map;
}
