import { Component } from '@angular/core';
import { Model, getPonyTag } from '../../services/model';
import { defaultPonyState } from '../../../client/ponyHelpers';
import { GameService } from '../../services/gameService';
import { OAuthProvider, PonyObject } from '../../../common/interfaces';
import { stand } from '../../../client/ponyAnimations';
import { faExclamationCircle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { faBullhorn } from '../../../client/icons';

import { parseAccountAlert, AlertType } from '../../../common/utils';
import { GlobalAlertsService } from '../../services/global-alerts.service';
import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
	selector: 'home',
	templateUrl: 'home.pug',
	styleUrls: ['home.scss'],
})
export class Home {
	state = defaultPonyState();
	previewPony: PonyObject | undefined = undefined;
	error?: string;
	private animationTime = 0;
	private interval?: any;
	showFullWarning = false;
	showLoginWarning = false;
	readonly warningIcon = faExclamationCircle;
	globalAlertsEntries$ = combineLatest([
		this.globalAlertsService.globalAlerts$,
		this.model.accountChanged.pipe(map(() => parseAccountAlert(this.model.accountAlert)))
	]).pipe(
		map(([global, local]) => [...global, ...local])
	);

	constructor(
		private gameService: GameService,
		private model: Model,
		private globalAlertsService: GlobalAlertsService,
	) {}
	get authError() {
		return this.model.authError;
	}

	// accountAlertEntries устарел, используйте globalAlertsEntries$

	       alertClass(type: AlertType) {
		       switch (type) {
			       case 'danger': return 'alert-danger';
			       case 'info': return 'alert-info';
			       case 'announcement': return 'alert-announcement';
			       default: return 'alert-warning';
		       }
	       }

	       alertIcon(type: AlertType) {
		       switch (type) {
			       case 'danger': return this.warningIcon;
			       case 'info': return faInfoCircle;
			       case 'announcement': return faBullhorn;
			       default: return this.warningIcon;
		       }
	       }

	get accountAlert() {
		return this.model.accountAlert;
	}
	get canInstall() {
		return false;
	}
	get playing() {
		return this.gameService.playing;
	}
	get loading() {
		return this.model.loading || this.model.updating;
	}
	get account() {
		return this.model.account;
	}
	get pony() {
		return this.model.pony;
	}
	get previewInfo() {
		return this.previewPony ? this.previewPony.ponyInfo : this.pony.ponyInfo;
	}
	get previewName() {
		return this.previewPony ? this.previewPony.name : this.pony.name;
	}
	get previewTag() {
		return getPonyTag(this.previewPony || this.pony, this.account);
	}
	signIn(provider: OAuthProvider) {
		this.model.signIn(provider);
	}
	toggleFullWarning() {
		this.showFullWarning = !this.showFullWarning;
	}
	ngOnInit() {
		this.model.loginServerStatus()
			.then(show => this.showLoginWarning = show)
			.catch(() => {
				this.showLoginWarning = false;
			});

		let last = Date.now();
		this.interval = setInterval(() => {
			const now = Date.now();
			this.update((now - last) / 1000);
			last = now;
		}, 1000 / 24);
	}
	ngOnDestroy() {
		clearInterval(this.interval);
	}
	update(delta: number) {
		this.animationTime += delta;
		const animation = stand;
		this.state.animation = animation;
		this.state.animationFrame = Math.floor(this.animationTime * animation.fps) % animation.frames.length;
	}
}
