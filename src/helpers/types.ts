export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type PageQuery = {
  page?: number | string | null;
  pageSize?: number | string | null;
};
