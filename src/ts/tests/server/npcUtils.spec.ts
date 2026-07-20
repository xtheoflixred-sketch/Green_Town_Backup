import { expect } from 'chai';
import { NPCUtils } from '../../server/NPCUtils';
import { createServerMap } from '../../server/serverMap';
import { MapType, TileType } from '../../common/interfaces';
import { SUPPORTER_PONY } from '../../common/constants';

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;

class FakeWorld {
	public entityById = new Map<number, any>();
	private nextId = 1;

	public addEntity(entity: any) {
		entity.id = entity.id || this.nextId++;
		this.entityById.set(entity.id, entity);
		return entity;
	}
	public removeEntity(entity: any) {
		this.entityById.delete(entity.id);
		return true;
	}
	public getEntityById(id: number) {
		return this.entityById.get(id);
	}
}

describe('NPCUtils', () => {
	it('registers NPCs through the world entity registry without attaching them to a client', () => {
		const world = new FakeWorld();
		const map = createServerMap('TestMap', MapType.None, 16, 16, TileType.Grass);
		const npcUtils = new NPCUtils(world as any);
		const npc = npcUtils.createAndRegisterNPC({
			id: 'npc-test',
			name: 'Test NPC',
			x: 5,
			y: 6,
			map,
		});

		expect(npc.npcId).equal('npc-test');
		expect(npc.name).equal('Test NPC');
		expect(world.getEntityById(npc.id)).equal(npc);
		expect((npc as any).client).undefined;
	});

	it('uses a predefined compressed pony skin string when provided', () => {
		const world = new FakeWorld();
		const map = createServerMap('TestMap', MapType.None, 16, 16, TileType.Grass);
		const npcUtils = new NPCUtils(world as any);
		const npc = npcUtils.createAndRegisterNPC({
			id: 'npc-skin-test',
			name: 'Skin NPC',
			x: 7,
			y: 8,
			map,
			info: SUPPORTER_PONY,
		});

		expect(npc.info).equal(SUPPORTER_PONY);
		expect(npc.infoSafe).equal(SUPPORTER_PONY);
	});
});
