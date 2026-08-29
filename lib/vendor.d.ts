/**
 * Provider attribution: map a provider route id to its real vendor identity
 * (base-URL host) and its credential reference name (the `apiKeyEnv` the route
 * resolves its key through). Provider ids alone are just routes; both facts
 * come from the provider's settings section, with the provider id as fallback.
 */
import type { Context } from './types.js';
export interface VendorResolver {
    /** Resolve the display vendor for one provider route. */
    vendorOf(provider: string): string;
    /** Resolve the credential reference name for one provider route, when configured. */
    credentialRefOf(provider: string): string | undefined;
}
export declare function createVendorResolver(ctx: Context): VendorResolver;
