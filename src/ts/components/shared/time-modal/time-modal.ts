import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { faPause, faPlay } from '../../../client/icons';

interface TimeStatus {
	time: number;
	formattedTime: string;
	isFrozen: boolean;
	isAtSpecificHour: boolean;
	speed: number;
	hour: number;
}

@Component({
	selector: 'time-modal',
	templateUrl: 'time-modal.pug',
	styleUrls: ['time-modal.scss'],
})
export class TimeModal implements OnInit {
	@Output() close = new EventEmitter<void>();
	status?: TimeStatus;
	loading = false;
	error = '';
	hourInput = '12';
	minuteInput = '00';
	readonly playIcon = faPlay;
	readonly pauseIcon = faPause;

	constructor(private http: HttpClient) {}

	ngOnInit() {
		this.loadStatus();
	}

	loadStatus() {
		this.loading = true;
		this.error = '';
		this.http.get<TimeStatus>('/api2/mod/time').subscribe(status => {
			this.applyStatus(status);
			this.loading = false;
		}, () => {
			this.error = 'Could not load server time';
			this.loading = false;
		});
	}

	setTime(action: 'set' | 'freeze') {
		const hour = Number(this.hourInput);
		const minute = Number(this.minuteInput);
		if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
			this.error = 'Enter a valid time from 00:00 to 23:59';
			return;
		}

		this.sendAction(action, hour + minute / 60);
	}

	sendAction(action: 'set' | 'freeze' | 'resume' | 'day' | 'night', hour?: number) {
		this.loading = true;
		this.error = '';
		this.http.post<TimeStatus>('/api2/mod/time', { action, hour }).subscribe(status => {
			this.applyStatus(status);
			this.loading = false;
		}, () => {
			this.error = 'Could not change server time';
			this.loading = false;
		});
	}

	private applyStatus(status: TimeStatus) {
		this.status = status;
		const parts = status.formattedTime.split(':');
		this.hourInput = parts[0];
		this.minuteInput = parts[1];
	}

	onClose() {
		this.close.emit();
	}
}
