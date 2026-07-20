import '../lib';
import { expect } from 'chai';
import { createServerMap, findEntities } from '../../server/serverMap';
import { mockClient } from '../mocks';
import { worldForTemplates } from '../../server/mapUtils';
import { createItemTrigger } from '../../server/controllerUtils';
import * as entities from '../../common/entities';
import { EntityFlags } from '../../common/interfaces';
import { ServerEntity, ServerMap } from '../../server/serverInterfaces';

describe('controllerUtils', () => {
	let map: ServerMap;
	let client: any;
	let world: any;

	beforeEach(() => {
		map = createServerMap('', 0, 1, 1);
		client = mockClient({ map });
		world = {
			addEntity: worldForTemplates.addEntity,
			removeEntity: worldForTemplates.removeEntity,
		};
	});

	it('drops items with pickable bounds and interaction', () => {
		const trigger = createItemTrigger(world, map, 0.5, 0.5, 'drop-test');
		world.addEntity(trigger, map);

		client.pony.options.hold = entities.carrotHeld.type;
	trigger.interact!(trigger, client, 0.5, 0.5);
		const dropped = findEntities(map, e => e.type === entities.carrot1.type);

		expect(dropped).to.have.lengthOf(1);
		expect(dropped[0].interactBounds).exist;
		expect(dropped[0].interactRange).equal(1.5);
		expect(dropped[0].flags & EntityFlags.Interactive).not.equal(0);
		expect(client.pony.options.hold).undefined;
	});

	it('drops items across the area trigger instead of only at a single point', () => {
		const trigger = createItemTrigger(world, map, 0.5, 0.5, 'area-drop-test', undefined, entities.itemTriggerArea);
		world.addEntity(trigger, map);

		const random = Math.random;
		Math.random = () => 0.25;

		try {
			client.pony.options.hold = entities.carrotHeld.type;
			trigger.interact!(trigger, client, 1000, 1000);

			const dropped = findEntities(map, e => e.type === entities.carrot1.type);
			expect(dropped).to.have.lengthOf(1);
			expect(dropped[0].x).equal(-11.5);
			expect(dropped[0].y).equal(-11.5);
		} finally {
			Math.random = random;
		}
	});

	it('drops items at cursor position inside the area trigger when coordinates are provided', () => {
		const trigger = createItemTrigger(world, map, 0.5, 0.5, 'area-drop-test', undefined, entities.itemTriggerArea);
		world.addEntity(trigger, map);

		client.pony.options.hold = entities.carrotHeld.type;
		trigger.interact!(trigger, client, -11.0, -11.0);

		const dropped = findEntities(map, e => e.type === entities.carrot1.type);
		expect(dropped).to.have.lengthOf(1);
		expect(dropped[0].x).equal(-11.0);
		expect(dropped[0].y).equal(-11.0);
	});

	it('drops items randomly inside the area trigger when interact coords are outside the trigger', () => {
		const trigger = createItemTrigger(world, map, 0.5, 0.5, 'area-drop-outside-test', undefined, entities.itemTriggerArea);
		world.addEntity(trigger, map);

		const random = Math.random;
		Math.random = () => 0.25;

		try {
			client.pony.options.hold = entities.carrotHeld.type;
			trigger.interact!(trigger, client, 1000, 1000);

			const dropped = findEntities(map, e => e.type === entities.carrot1.type);
			expect(dropped).to.have.lengthOf(1);
			expect(dropped[0].x).equal(trigger.x - 24 + 0.25 * 48);
			expect(dropped[0].y).equal(trigger.y - 24 + 0.25 * 48);
		} finally {
			Math.random = random;
		}
	});

	it('picks any object placed on the trigger when empty-handed', () => {
		const trigger = createItemTrigger(world, map, 0.5, 0.5, 'pickup-test');
		world.addEntity(trigger, map);

		const barrel = entities.barrel(0.5, 0.5) as ServerEntity;
		world.addEntity(barrel, map);

		client.pony.options.hold = undefined;
		trigger.interact!(trigger, client, 0.5, 0.5);

		expect(client.pony.options.hold).equal(barrel.type);
		expect(findEntities(map, e => e === barrel)).eql([]);
	});

	it('does not pick object when click inside trigger misses the object sprite', () => {
		let emptyCalled = false;
		const trigger = createItemTrigger(world, map, 0.5, 0.5, 'pickup-test', () => {
			emptyCalled = true;
		}, entities.itemTriggerArea);
		world.addEntity(trigger, map);

		const barrel = entities.barrel(0.5, 0.5) as ServerEntity;
		world.addEntity(barrel, map);

		client.pony.options.hold = undefined;
		trigger.interact!(trigger, client, 10, 10);

		expect(emptyCalled).true;
		expect(client.pony.options && client.pony.options.hold).undefined;
		expect(findEntities(map, e => e === barrel)).eql([barrel]);
	});

	it('does not pick object without explicit click coordinates', () => {
		let emptyCalled = false;
		const trigger = createItemTrigger(world, map, 0.5, 0.5, 'pickup-test', () => {
			emptyCalled = true;
		}, entities.itemTriggerArea);
		world.addEntity(trigger, map);

		const barrel = entities.barrel(0.5, 0.5) as ServerEntity;
		world.addEntity(barrel, map);

		client.pony.options.hold = undefined;
		const result = trigger.interact!(trigger, client);

		expect(result).false;
		expect(emptyCalled).false;
		expect(client.pony.options && client.pony.options.hold).undefined;
		expect(findEntities(map, e => e === barrel)).eql([barrel]);
	});

	it('picks object when click hits its sprite inside trigger', () => {
		const trigger = createItemTrigger(world, map, 0.5, 0.5, 'pickup-test', undefined, entities.itemTriggerArea);
		world.addEntity(trigger, map);

		const barrel = entities.barrel(0.5, 0.5) as ServerEntity;
		world.addEntity(barrel, map);

		client.pony.options.hold = undefined;
		trigger.interact!(trigger, client, 0.5, 0.5);

		expect(client.pony.options && client.pony.options.hold).equal(barrel.type);
		expect(findEntities(map, e => e === barrel)).eql([]);
	});

	it('picks object when click near its sprite inside trigger', () => {
		const trigger = createItemTrigger(world, map, 0.5, 0.5, 'pickup-test', undefined, entities.itemTriggerArea);
		world.addEntity(trigger, map);

		const barrel = entities.barrel(0.5, 0.5) as ServerEntity;
		world.addEntity(barrel, map);

		client.pony.options.hold = undefined;
		trigger.interact!(trigger, client, 0.9, 0.5);

		expect(client.pony.options && client.pony.options.hold).equal(barrel.type);
		expect(findEntities(map, e => e === barrel)).eql([]);
	});
});
