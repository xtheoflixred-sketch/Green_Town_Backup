import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Model } from '../../services/model';
import { signUpProviders, signInProviders } from '../../../client/data';
import { emptyIcon, oauthIcons } from '../../../client/icons';
import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { OAuthProvider } from '../../../common/interfaces';
import { MockAccount } from '../../shared/mock-login-modal/mock-login-modal';

@Component({
	selector: 'welcome-page',
	templateUrl: 'welcome.pug',
	styleUrls: ['welcome.scss'],
})
export class Welcome implements OnInit {
	readonly signUpProviders = signUpProviders;
	readonly signInProviders = signInProviders;
	readonly warningIcon = faExclamationCircle;
	showLoginWarning = false;
	showFullWarning = false;
	showMockLogin = false;
	showMockLoginButton = false;
	mockAccounts: MockAccount[] = [];

	constructor(private http: HttpClient, private model: Model, public router: Router) {
		this.loadMockAccounts();
	}

	get account() {
		return this.model.account;
	}

	icon(id: string) {
		return oauthIcons[id] || emptyIcon;
	}

	signIn(provider: OAuthProvider) {
		this.model.signIn(provider);
	}

	toggleFullWarning() {
		this.showFullWarning = !this.showFullWarning;
	}

	onMockLogin() {
		this.showMockLogin = true;
	}

	onMockLoginClose() {
		this.showMockLogin = false;
	}

	onMockLoginSubmit(data: { id: string }) {
		window.location.href = `/auth/local?password=x&username=${data.id}`;
	}

	onMockCreateAccount(event?: any) {
		if (event && event.id) {
			this.mockAccounts.unshift(event as MockAccount);
			return;
		}

		if (event && event.redirect) {
			window.location.href = '/auth/local?signup=1';
			return;
		}

		window.location.href = '/auth/local?signup=1';
	}

	loadMockAccounts() {
		this.http.get<MockAccount[]>('/mock-login/accounts').subscribe(
			accounts => this.mockAccounts = accounts,
			error => console.error('Не удалось загрузить список аккаунтов для mock-login', error)
		);
	}

	ngOnInit() {
		this.model.accountPromise
			.then(account => {
				if (account) {
					this.router.navigate(['/']);
				}
			})
			.catch(() => {
			});

		this.model.loginServerStatus()
			.then(show => this.showLoginWarning = show)
			.catch(() => this.showLoginWarning = false);
	}
}
