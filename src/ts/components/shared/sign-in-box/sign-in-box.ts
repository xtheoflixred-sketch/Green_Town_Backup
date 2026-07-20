import { Output, EventEmitter, Input, Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signUpProviders, signInProviders } from '../../../client/data';
import { emptyIcon, oauthIcons } from '../../../client/icons';
import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { OAuthProvider } from '../../../common/interfaces';
import { MockAccount } from '../mock-login-modal/mock-login-modal';

export function getProviderIcon(id: string) {
	return oauthIcons[id] || emptyIcon;
}

@Component({
	selector: 'sign-in-box',
	templateUrl: 'sign-in-box.pug',
	styleUrls: ['sign-in-box.scss'],
})
export class SignInBox implements OnInit {
	readonly signUpProviders = signUpProviders;
	readonly signInProviders = signInProviders;
	readonly warningIcon = faExclamationCircle;
	@Input() showLoginWarning = false;
	showFullWarning = false;
	showMockLogin = false;
	showMockLoginButton = false;
	@Output() signIn = new EventEmitter<OAuthProvider>();
	mockAccounts: MockAccount[] = [];

	constructor(private http: HttpClient) {
		this.loadMockAccounts();
	}

	ngOnInit() {
		this.http.get<{ mockLoginEnabled?: boolean }>('/api2/game/login-status').subscribe(
			status => this.showMockLoginButton = !!status.mockLoginEnabled,
			error => console.error('Не удалось загрузить статус логина', error)
		);
	}

	loadMockAccounts() {
		this.http.get<MockAccount[]>('/mock-login/accounts').subscribe(
			accounts => this.mockAccounts = accounts,
			error => console.error('Не удалось загрузить список аккаунтов для mock-login', error)
		);
	}

	icon(id: string) {
		return getProviderIcon(id);
	}
	signInTo(provider: OAuthProvider) {
		this.signIn.emit(provider);
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
	onMockLoginSubmit(data: {id: string}) {
		// Перенаправление на URL аутентификации
		window.location.href = `/auth/local?password=x&username=${data.id}`;
	}

	onMockCreateAccount(event?: any) {
		if (event && event.id) {
			// append created account to our cached list
			this.mockAccounts.unshift(event as MockAccount);
			return;
		}

		if (event && event.redirect) {
			window.location.href = '/auth/local?signup=1';
			return;
		}

		// default behaviour: redirect to simple registration
		window.location.href = '/auth/local?signup=1';
	}
}
