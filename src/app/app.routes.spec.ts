import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, provideRouter } from '@angular/router';

import { routes } from './app.routes';

@Component({ template: '' })
class Stub {}

/** The same tree of routes, without guards nor the real pages. */
function stubbed(list: Route[]): Route[] {
  return list.map(({ loadComponent, canActivate, children, ...route }) => ({
    ...route,
    ...(loadComponent ? { component: Stub } : {}),
    ...(children ? { children: stubbed(children) } : {}),
  }));
}

describe('routes', () => {
  it.each([
    ['/libraries', 'Bibliotecas', {}],
    ['/libraries/shared', 'Compartidas conmigo', {}],
    ['/libraries/shared/l1', 'Biblioteca compartida', { id: 'l1' }],
    ['/libraries/l1', 'Biblioteca', { id: 'l1' }],
    ['/books', 'Libros', {}],
    ['/books/shared', 'Libros compartidos', {}],
    ['/libraries/l1/imports/i1', 'Importación', { id: 'l1', importId: 'i1' }],
  ])('%s opens «%s»', async (url, title, params) => {
    TestBed.configureTestingModule({ providers: [provideRouter(stubbed(routes))] });
    const router = TestBed.inject(Router);

    await router.navigateByUrl(url);

    let route = router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    expect(router.url).toBe(url);
    expect(route.title).toBe(`${title} · Bibliopolis`);
    expect(route.params).toEqual(params);
  });
});
