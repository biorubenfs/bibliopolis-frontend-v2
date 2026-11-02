export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  results: {
    type: 'auth';
    attributes: { accessToken: string };
  };
}
