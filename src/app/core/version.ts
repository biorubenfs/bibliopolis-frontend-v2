import { version } from '../../../package.json';

/** Version from package.json, inlined at build time (esbuild tree-shakes the rest of the file). */
export const APP_VERSION: string = version;
