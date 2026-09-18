import type { RepairAction } from '../types.ts';

/**
 * Built-in Levenshtein distance implementation.
 * Replaces the `fastest-levenshtein` dependency for zero-dependency usage.
 */
export function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);

	for (let i = 1; i <= m; i++) {
		let prev = dp[0];
		dp[0] = i;
		for (let j = 1; j <= n; j++) {
			const tmp = dp[j];
			if (a[i - 1] === b[j - 1]) {
				dp[j] = prev;
			} else {
				dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
			}
			prev = tmp;
		}
	}

	return dp[n]!;
}

export function distance(a: string, b: string): number {
	return levenshtein(a, b);
}
