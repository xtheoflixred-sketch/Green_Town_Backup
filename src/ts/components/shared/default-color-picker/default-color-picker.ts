import { Component, ElementRef } from '@angular/core';
import { ColorPicker } from '../color-picker/color-picker';

@Component({
	selector: 'default-color-picker',
	templateUrl: '../color-picker/color-picker.pug',
	styleUrls: ['../color-picker/color-picker.scss'],
})
export class DefaultColorPicker extends ColorPicker {
	constructor(element: ElementRef) {
		super(element);
	}
}
