import { Component, ViewChild, TemplateRef, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { tiktokLink } from '../../../client/data';
import { faTiktok } from '../../../client/icons';
import { TiktokPony } from '../tiktok-pony/tiktok-pony';

@Component({
	selector: 'tiktok-button',
	templateUrl: 'tiktok-button.pug',
	styleUrls: ['tiktok-button.scss'],
	encapsulation: ViewEncapsulation.Emulated,
})
export class TiktokButton implements OnInit, OnDestroy {
	readonly tiktokLink = tiktokLink;
	readonly enableVisitTiktokButton = true;
	readonly tiktokIcon = faTiktok;
	isNudging = false;
	currentModalRef?: BsModalRef;
	@ViewChild('leaveSiteModal', { static: true }) leaveSiteModalTpl!: TemplateRef<any>;
	@ViewChild('pony', { static: false }) ponyComp!: TiktokPony;

	private lastInteractionTime = 0;
	private nudgeTimer?: number;
	private nudgeResetTimer?: number;
	private nudgeThreshold = this.randomBetween(15000, 45000);

	constructor(private modalService: BsModalService) {}

	ngOnInit() {
		this.lastInteractionTime = Date.now();
		this.scheduleNextNudgeCheck();
	}

	ngOnDestroy() {
		window.clearTimeout(this.nudgeTimer);
		window.clearTimeout(this.nudgeResetTimer);
	}

	onInteract() {
		this.lastInteractionTime = Date.now();
		this.nudgeThreshold = this.randomBetween(15000, 45000);
		this.isNudging = false;
		window.clearTimeout(this.nudgeResetTimer);
	}

	private scheduleNextNudgeCheck() {
		this.nudgeTimer = window.setTimeout(() => {
			if (Date.now() - this.lastInteractionTime > this.nudgeThreshold && !this.isNudging) {
				this.triggerNudge();
				this.nudgeThreshold = this.randomBetween(15000, 45000);
			}
			this.scheduleNextNudgeCheck();
		}, this.randomBetween(3500, 9000));
	}

	private triggerNudge() {
		this.isNudging = true;
		if (this.ponyComp) {
			this.ponyComp.nudge();
		}
		this.nudgeResetTimer = window.setTimeout(() => {
			this.isNudging = false;
			this.lastInteractionTime = Date.now();
		}, this.randomBetween(850, 1300));
	}

	private randomBetween(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	openLeaveModal() {
		this.currentModalRef = this.modalService.show(this.leaveSiteModalTpl, { class: 'modal-sm' });
	}

	closeLeaveModal() {
		this.currentModalRef && this.currentModalRef.hide();
		this.currentModalRef = undefined;
	}

	confirmLeave() {
		window.open(this.tiktokLink, '_blank', 'noopener');
		this.closeLeaveModal();
	}
}
