import * as fs from 'fs';
import * as entities from '../../common/entities';
import { rect } from '../../common/rect';
import { TileType, MapType, MapFlags } from '../../common/interfaces';
import { createServerMap, deserializeMap } from '../serverMap';
import { World, goToMap } from '../world';
import { createSign, createSignWithText, createItemTrigger } from '../controllerUtils';
import { ServerEntity } from '../serverInterfaces';
import { pathTo } from '../paths';
import { pickGift, pickCandy, pickEgg, pickClover } from '../mapUtils';
import { pushRemoveEntityToClient } from '../entityUtils';
import { saySystem } from '../chat';

// To customize the map use in-game editor tools to change tiles, then use `/savemap custom` command,
// your map will be saved to `/store/custom.json` file, move the file to `/src/maps/custom.json`!
// and restart the server.
const mapData = JSON.parse(fs.readFileSync(pathTo('src', 'maps', 'custom.json'), 'utf8'));

export function createCustomMap(world: World) {
	// size: 4 by 4 regions -> 32 by 32 tiles
	// default tiles: grass
	const map = createServerMap('custom', MapType.None, 4, 4, TileType.Grass);

	// initialize tiles
	if (typeof mapData.flags === 'number') {
		map.flags |= mapData.flags;
	}
	deserializeMap(map, mapData);

	// place default spawn point at the center of the map
	map.spawnArea = rect(map.width / 2, map.height / 2, 0, 0);
	map.flags |= MapFlags.EditableEntities;
	map.editableEntityLimit = 100;

	// shorthand for adding entities
	function add(entity: ServerEntity) {
		return world.addEntity(entity, map);
	}

	// exit to the main map
	add(entities.triggerHouseDoor(10, 14.5)).trigger = (_entity: any, client: any) => goToMap(world, client, 'main');
	add(createSign(10, 15, 'click me to exit', (_, client) => goToMap(world, client, 'main'), entities.sign));

	// place barrel at 5, 5 location
	add(entities.barrel(5, 5));

	// first test item trigger on the map
	add(createItemTrigger(world, map, 8, 8, 'Item Drop Trigger', (_entity, client) => {
		saySystem(client, 'Hold an item and interact with the trigger to drop it.');
	}));

	// additional large test item trigger for custom map
	add(createItemTrigger(world, map, 20, 12, 'Large Item Drop Trigger', (_entity, client) => {
		saySystem(client, 'Hold an item and interact with the large trigger to drop it.');
	}, entities.itemTriggerArea));

	// helper: create an instant-respawn collectable with unified behaviour
	function createInstantCollectable(x: number, y: number, ctor: any, onCollect: (client: any) => void, range = 1.5, respawnDelay = 50) {
		function spawn() {
			const ent = ctor(x, y) as ServerEntity;
			ent.interactRange = ent.interactRange || range;

			const handleInteract = (_entity: any, client: any) => {
				if (client.shadowed) {
					// invisible player: don't award, just remove on their client
					pushRemoveEntityToClient(client, _entity);
					return;
				}

				// remove current instance so player sees it disappear
				world.removeEntity(_entity, map);

				// award immediately (hold item, counters, messages)
				onCollect(client);

				// respawn a visible instance shortly after so player notices the pickup
				setTimeout(() => {
					const next = ctor(x, y) as ServerEntity;
					next.interactRange = next.interactRange || range;
					next.interact = handleInteract; // reuse same handler
					world.addEntity(next, map);
				}, respawnDelay);
			};

			ent.interact = handleInteract;
			world.addEntity(ent, map);
		}

		spawn();
	}

	// special instant-respawn gift for testing at 20,15 (uses unified helper)
	createInstantCollectable(20, 15, entities.gift2, (c) => pickGift(c));


	// sign with name 'test collectable objects' at 20.25,14
	// show milestones list instead of awarding items; message should be from the sign itself
	add(createSignWithText(20.25, 14, 'test collectable objects', 'Достижения:\nПодарки: каждые 100\nЯйца: каждые 50\nКлеверы: каждые 25\nКонфеты: каждые 75', entities.sign));

	// extra egg (egg-1-0) at 19.25,15
	createInstantCollectable(19.25, 15, entities.eggs[0], (c) => pickEgg(c));

	// four-leaf-clover at 20.625,14.5
	createInstantCollectable(20.625, 14.5, entities.fourLeafClover, (c) => pickClover(c));

	// candy at 21.25,14.8
	createInstantCollectable(21.25, 14.8, entities.candy, (c) => pickCandy(c));


	// place more entities here ...

	// place a few tables with trigger areas for testing
	add(entities.table1(12.5, 11.5));
	add(entities.table2(15.0, 11.8));
	add(entities.table3(10.0, 12.0));

	return map;
}
