import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/firestore';
import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { User } from './user.interface';
import { ProfileService } from '../profile.service';
import { NavController, Platform } from '@ionic/angular';
import { cfaSignIn, cfaSignOut } from 'capacitor-firebase-auth';
import { auth } from 'firebase';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
    providedIn: 'root'
})

export class AuthenticationService {
    userData: any;

    private loginWithMobileSocial: boolean;
    constructor(
        public afStore: AngularFirestore,
        public ngFireAuth: AngularFireAuth,
        public router: Router,
        public ngZone: NgZone,
        public profileService: ProfileService,
        public navCtrl: NavController,
        private platform: Platform
    ) {
        this.loginWithMobileSocial = false;
        this.ngFireAuth.authState.subscribe(user => {
            if (user) {
                this.userData = user;
                localStorage.setItem('user', JSON.stringify(this.userData));
                JSON.parse(localStorage.getItem('user'));
            } else {
                localStorage.setItem('user', null);
                JSON.parse(localStorage.getItem('user'));
            }
        })
    }

    // Login in with email/password
    SignIn(email, password) {
        return this.ngFireAuth.auth.signInWithEmailAndPassword(email, password);
    }

    // Register user with email/password
    RegisterUser(email, password) {
        return this.ngFireAuth.auth.createUserWithEmailAndPassword(email, password);
    }

    // Email verification when new user register
    async SendVerificationMail() {
        return this.ngFireAuth.auth.currentUser.sendEmailVerification()
            .then(() => {
                this.router.navigate(['verify-email']);
            });
    }

    // Recover password
    PasswordRecover(passwordResetEmail) {
        return this.ngFireAuth.auth.sendPasswordResetEmail(passwordResetEmail)
            .then(() => {
                window.alert('Password reset email has been sent, please check your inbox.');
            }).catch((error) => {
                window.alert(error)
            })
    }

    // Returns true when user is looged in
    get isLoggedIn(): boolean {
        const user = JSON.parse(localStorage.getItem('user'));
        return (user !== null && user.emailVerified !== false) ? true : false;
    }

    // Returns true when user's email is verified
    get isEmailVerified(): boolean {
        const user = JSON.parse(localStorage.getItem('user'));
        return (user.emailVerified !== false) ? true : false;
    }

    // Sign in with Gmail
    GoogleAuth(): Promise<User> {
        if (this.platform.is('capacitor')) {
            return this.mobileSocialAuth().toPromise();
        } else {
            return this.authLogin(new auth.GoogleAuthProvider());
        }
    }

    private mobileSocialAuth() {
        return cfaSignIn('google.com')
            .pipe(
                tap(async (user: User) => {
                    this.loginWithMobileSocial = true;
                    this.signInSuccess(user);
                }),
                catchError(error => {
                    window.alert(error);
                    return of(error);
                })
            );
    }

    // Auth providers
    private async authLogin(provider): Promise<User> {
        try {
            const authorization = await this.ngFireAuth.auth.signInWithPopup(provider);
            this.signInSuccess(authorization.user);
            return authorization.user;
        } catch (error) {
            window.alert(error);
        }
    }

    private async signInSuccess(user: User) {
        this.SetUserData(user);
        const hasProfile = await this.profileService.hasProfile();
        if (hasProfile) {
            this.navCtrl.navigateRoot('home/tabs/tab1');
        } else {
            this.router.navigate(['profile']);
        }
    }

    private signOutSuccess() {
        localStorage.removeItem('user');
        this.router.navigate(['login']);
    }

    // Store user in localStorage
    SetUserData(user) {
        const userRef: AngularFirestoreDocument<any> = this.afStore.doc(`users/${user.uid}`);
        const userData: User = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            emailVerified: user.emailVerified
        };
        return userRef.set(userData, {
            merge: true
        });
    }

    // Sign-out
    SignOut(): Promise<void> {
        if (this.loginWithMobileSocial) {
            return cfaSignOut().pipe(
                tap(() => {
                    this.loginWithMobileSocial = false;
                    this.signOutSuccess();
                })
            ).toPromise();
        } else {
            this.ngFireAuth.auth.signOut().then(() => {
                this.signOutSuccess();
            });
        }
    }

    // GetCurrentUser() {
    //     if (this.isLoggedIn) {
    //         return this.ngFireAuth.auth.currentUser;
    //     } else {
    //         return null;
    //     }
    // }

}
