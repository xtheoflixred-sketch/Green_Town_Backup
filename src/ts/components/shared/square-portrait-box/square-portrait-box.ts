import { Component, Input } from '@angular/core';
import { PalettePonyInfo } from '../../../common/interfaces';

@Component({
	selector: 'square-portrait-box',
	templateUrl: 'square-portrait-box.pug',
	styleUrls: ['square-portrait-box.scss'],
})
export class SquarePortraitBox {
	@Input() noBorder = false;
	@Input() flip = false;
	@Input() size = 'large';
	@Input() pony: PalettePonyInfo | undefined = undefined;
	@Input() chatHoverColor: number | undefined = undefined;

	get squareSize() {
		return `${this.size}-square`;
	}
}
