/** Single resource envelope returned by the backend. */
export interface ApiResource<T> {
  type: string;
  id: string;
  attributes: T;
}

export interface ApiItemResponse<T> {
  results: ApiResource<T>;
}

export interface ApiCollectionResponse<T> {
  results: ApiResource<T>[];
  paginationInfo: { skip: number; limit: number; total: number };
}

export interface Page<T> {
  items: T[];
  total: number;
}

export function flatten<T>(resource: ApiResource<T>): T & { id: string } {
  return { ...resource.attributes, id: resource.id };
}
