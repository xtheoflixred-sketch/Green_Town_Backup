import * as entities from './entities';

const rareHoldTypeList = [
	entities.gift2.type,
	entities.cloverPick.type,
	entities.cloverPick2.type,
	entities.jackoLantern.type,
	entities.jackoLanternOn.type,
	entities.jackoLanternOff.type,
	entities.crystalLantern.type,
	...entities.eggBaskets.map(b => b.type),
];

export const rareHoldTypes = new Set<number>(rareHoldTypeList);
export const rareHoldTypeNames = rareHoldTypeList.map(type => entities.getEntityTypeName(type));

export function isRareHoldType(type: number | undefined) {
	return !!type && rareHoldTypes.has(type);
}
