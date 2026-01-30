export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  config: string | null;
  createdAt: number;
}
