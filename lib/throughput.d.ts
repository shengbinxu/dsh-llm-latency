import type { Sample } from './sample.js';
/** Counts and durations for exactly the successful calls eligible for each rate. */
export interface ThroughputAgg {
    outputRateTokens: number;
    outputRateMs: number;
    outputRateSamples: number;
    overallRateTokens: number;
    overallRateMs: number;
    overallRateSamples: number;
}
export declare function emptyThroughput(): ThroughputAgg;
/** Visible-answer tokens require an explicit reasoning count and no unpriced tool output. */
export declare function visibleOutputTokens(sample: Sample): number | null;
export declare function sampleThroughput(sample: Sample): ThroughputAgg;
/** Missing aggregate fields belong to historical data and contribute no eligible samples. */
export declare function mergeThroughput(dst: ThroughputAgg, src: Partial<ThroughputAgg>): void;
export declare function throughputRate(tokens: number, durationMs: number): number | null;
