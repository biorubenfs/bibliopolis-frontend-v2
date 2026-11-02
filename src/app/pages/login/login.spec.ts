import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';
import { Login } from './login';

describe('Login', () => {
  let loginResult: Observable<void>;
  const login = vi.fn(() => loginResult);

  function setup() {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: { login } }],
    });
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return fixture;
  }

  function fillAndSubmit(element: HTMLElement, email: string, password: string) {
    const [emailInput, passwordInput] = Array.from(element.querySelectorAll('input'));
    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  beforeEach(() => login.mockClear());

  it('does not call the backend when the form is invalid', () => {
    const fixture = setup();
    fillAndSubmit(fixture.nativeElement, 'not-an-email', '');
    expect(login).not.toHaveBeenCalled();
  });

  it('navigates to the libraries after a successful login', () => {
    loginResult = of(undefined);
    const fixture = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    fillAndSubmit(fixture.nativeElement, 'user@email.com', 'secret');

    expect(login).toHaveBeenCalledWith({ email: 'user@email.com', password: 'secret' });
    expect(navigate).toHaveBeenCalledWith('/libraries');
  });

  it('shows a Spanish message when the credentials are wrong', async () => {
    loginResult = throwError(() => new ApiError(403, 'INVALID CREDENTIALS ERROR', 'invalid'));
    const fixture = setup();

    fillAndSubmit(fixture.nativeElement, 'user@email.com', 'wrong');
    await fixture.whenStable();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('El email o la contraseña no son correctos.');
  });
});
