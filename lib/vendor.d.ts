/**
 * Vendor attribution: map a provider route id to a real vendor identity.
 * Provider ids alone are just routes; the vendor is the base URL host when the
 * provider is configured with one (e.g. Alibaba Bailian `dashscope.aliyuncs.com`
 * vs DeepSeek official `api.deepseek.com`). Falls back to the provider id.
 */
import type { Context } from './types.js';
export interface VendorResolver {
    /** Resolve the display vendor for one provider route. */
    vendorOf(provider: string): string;
    /** Snapshot of provider route -> vendor host. */
    providers(): Record<string, string>;
}
export declare function createVendorResolver(ctx: Context): VendorResolver;
