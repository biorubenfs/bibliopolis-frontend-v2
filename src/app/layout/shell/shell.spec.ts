import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../core/users/user.model';
import { Shell } from './shell';

describe('Shell', () => {
  const logout = vi.fn();
  const user: User = {
    id: 'u1',
    name: 'Ana',
    email: 'ana@email.com',
    role: 'regular',
    avatar: '',
    createdAt: '',
    updatedAt: '',
  };

  async function render() {
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { currentUser: signal(user), loadCurrentUser: () => of(user), logout },
        },
      ],
    });
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the user and the navigation sections', async () => {
    const element = await render();

    expect(element.querySelector('.account')?.textContent).toContain('Ana');
    const links = Array.from(element.querySelectorAll('.nav-list a span')).map((a) =>
      a.textContent?.trim(),
    );
    expect(links).toEqual(['Mis bibliotecas', 'Mis libros', 'Explorar']);
  });

  it('links the avatar and the user name directly to the profile page', async () => {
    const element = await render();

    expect(element.querySelector('a.account')?.getAttribute('href')).toBe('/profile');
    expect(element.querySelector('mat-menu')).toBeNull();
  });

  it('logs out and goes to the login page', async () => {
    const element = await render();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    (element.querySelector('.logout') as HTMLButtonElement).click();

    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
