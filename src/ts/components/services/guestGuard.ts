import { Injectable } from '@angular/core';
import { Router, CanActivate } from '@angular/router';
import { Model } from './model';

@Injectable({
	providedIn: 'root',
})
export class GuestGuard implements CanActivate {
	constructor(private router: Router, private model: Model) {
	}
	canActivate() {
		return this.model.accountPromise.then(account => {
			if (!account) {
				return true;
			}
			this.router.navigate(['/']);
			return false;
		}) as any;
	}
}
