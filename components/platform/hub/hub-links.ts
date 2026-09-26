/** WP44-S11 Builder's Hub URLs, kept small so the shell can link without loading the Saved tools. */
const SAVED = "/dashboard/saved";

export const collectionHref = (collectionId: string) => `${SAVED}?collection=${collectionId}`;

export const compareHref = (slugs: readonly string[]) => `/dashboard/compare?ideas=${slugs.join(",")}`;
