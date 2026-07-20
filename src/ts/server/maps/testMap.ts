import { TileType, MapType } from '../../common/interfaces';
import { rect } from '../../common/rect';
import { createServerMap } from '../serverMap';
import { World, goToMap } from '../world';
import * as entities from '../../common/entities';
import { NPCUtils } from '../NPCUtils';

export function createTestMap(_world: World) {
	// size: 32 by 32 regions -> 256 by 256 tiles
	// default tiles: grass
	const map = createServerMap('TestMap', MapType.None, 32, 32, TileType.Grass);

	// place default spawn point at the center of the map
	map.spawnArea = rect(map.width / 2, map.height / 2, 0, 0);

	// shorthand for adding entities
	function add(entity: any) {
		return _world.addEntity(entity, map);
	}

	// trigger to exit TestMap at approximately 126, 126
	add(entities.trigger3x1(126, 126.5)).trigger = (_entity: any, client: any) => goToMap(_world, client, 'custom');

	const npcUtils = new NPCUtils(_world);
	npcUtils.spawnDefaultNPCs(map);

	// cave-cover decorations around the trigger exit
	add(entities.caveCover(125, 126));
	add(entities.caveCover(125, 127));
	add(entities.caveCover(126, 127));
	add(entities.caveCover(126, 126));


	return map;
}
