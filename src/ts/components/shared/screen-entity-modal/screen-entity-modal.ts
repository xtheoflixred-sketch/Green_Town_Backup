import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Entity, ScreenEntityOptions } from '../../../common/interfaces';
import { normalizeScreenSource } from '../../../common/entities';

@Component({
	selector: 'screen-entity-modal',
	templateUrl: 'screen-entity-modal.pug',
})
export class ScreenEntityModal {
	@Input() entity?: Entity;
	@Output() cancel = new EventEmitter<void>();
	@Output() save = new EventEmitter<ScreenEntityOptions>();
	@Output() playPause = new EventEmitter<'play' | 'pause'>();

	url = '';
	kind: 'youtube' | 'video' = 'video';
	width = 640;
	height = 360;
	muted = true;
	controls = true;
	error = '';

	ngOnInit() {
		const options = this.entity && this.entity.options as any || {};
		this.url = options.url || '';
		this.kind = options.kind === 'youtube' ? 'youtube' : 'video';
		this.width = options.width || 640;
		this.height = options.height || 360;
		this.muted = options.muted !== false;
		this.controls = options.controls !== false;
	}

	saveScreen() {
		const normalized = normalizeScreenSource(this.url, this.kind);
		if (!normalized) {
			this.error = this.kind === 'youtube'
				? 'Use an HTTPS YouTube /embed/ URL.'
				: 'Use a valid HTTPS video URL.';
			return;
		}
		this.save.emit({
			url: normalized.url,
			kind: normalized.kind,
			width: Math.max(160, Math.min(1920, Number(this.width) || 640)),
			height: Math.max(90, Math.min(1080, Number(this.height) || 360)),
			muted: this.muted,
			controls: this.controls,
		});
	}
}
