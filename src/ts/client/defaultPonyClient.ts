import { PonyInfo } from '../common/interfaces';
import { createServerDefaultPony } from '../common/ponyInfo';
import { decompressPonyString } from '../common/compressPony';
import { serverSettings } from './data';

/**
 * Get the configured default pony from server settings if available,
 * otherwise fall back to the built-in server default pony.
 * 
 * Priority:
 * 1. serverSettings.defaultPonyInfo from config (if present and valid)
 * 2. Built-in SERVER_DEFAULT_PONY_* constants
 */
export function getConfiguredDefaultPony(): PonyInfo {
	try {
		const configuredDefault = serverSettings && serverSettings.defaultPonyInfo;
		if (configuredDefault) {
			return decompressPonyString(configuredDefault, true);
		}
	} catch (e) {
		console.warn('Failed to load configured default pony, falling back to built-in default:', e);
	}
	
	// Fall back to built-in default
	return createServerDefaultPony();
}
