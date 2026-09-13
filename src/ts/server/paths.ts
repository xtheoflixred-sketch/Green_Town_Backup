import * as fs from 'fs';
import * as path from 'path';

export const root = path.join(__dirname, '..', '..', '..');
export const store = path.join(root, 'store');
export const savedMapsRoot = path.join(store, 'saved-maps');
export const savedMapRoot = path.join(savedMapsRoot, 'maps');
export const savedTilesRoot = path.join(savedMapsRoot, 'tiles');
export const savedEntitiesRoot = path.join(savedMapsRoot, 'entities');

export function pathTo(...parts: string[]) {
	return path.join(root, ...parts);
}

export function pathToSavedMap(kind: 'maps' | 'tiles' | 'entities', fileName: string) {
	const dir = kind === 'maps'
		? savedMapRoot
		: kind === 'tiles'
			? savedTilesRoot
			: savedEntitiesRoot;
	fs.mkdirSync(dir, { recursive: true });
	const safeFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
	return path.join(dir, safeFileName);
}
